import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { segmentTranscript } from './engine';
import { fetchYouTubeTranscript, fromPlainText, fromSrt } from './youtube';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';
import type { TranscriptInput, ArgumentSegment } from './types';

// ---------------------------------------------------------------------------
// Segment a transcript and stop there (owner call 2026-08-25).
//
// The whole-transcript audit at /api/transcript-audit runs segmentation, then
// up to twelve per-segment audits, then a gemini-2.5-pro synthesis. This route
// runs the first of those and hands the reader the map, so they can spend one
// ordinary audit on the segment they actually care about. Two model calls in
// total instead of roughly fourteen.
//
// No sign-in: nothing is written anywhere, so there is no account-shaped
// reason to ask for one. The cost ceiling is the daily quota below, keyed the
// same way the audit route keys its own (user id when signed in, IP when not).
// ---------------------------------------------------------------------------

const BodySchema = z.union([
  z.object({ kind: z.literal('youtube'), url:  z.string().url(),     title: z.string().optional() }),
  z.object({ kind: z.literal('text'),    text: z.string().min(200),  title: z.string().optional() }),
  z.object({ kind: z.literal('srt'),     srt:  z.string().min(50),   title: z.string().optional() }),
]);

/** What the browser is allowed to see.
 *
 *  Deliberately a projection rather than the raw ArgumentSegment: the model's
 *  0-100 `confidence` that a passage is argumentative is useful for ordering
 *  and useless to a reader, and any number shipped to a page eventually gets
 *  rendered as a badge. It orders the list here and stops here. */
export interface PickableSegment {
  id:           string;
  startSec:     number;
  endSec:       number;
  claimSummary: string;
  text:         string;
  words:        number;
}

export function forClient(segments: ArgumentSegment[]): PickableSegment[] {
  return segments
    .slice()
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .map((s) => ({
      id:           s.id,
      startSec:     s.startSec,
      endSec:       s.endSec,
      claimSummary: s.claimSummary,
      text:         s.text,
      words:        s.text.trim().split(/\s+/).filter(Boolean).length,
    }));
}

export interface SegmentHandlerDeps {
  rateLimitKv:   RateLimitKV | undefined;
  geminiApiKey:  string | undefined;
  /** Daily segmentations per signed-in user. */
  userDailyCap:  number;
  /** Daily segmentations per IP for anonymous callers. */
  anonDailyCap:  number;
  provider:      LlmProvider;
  getSession:    (request: Request) => Promise<{ userId: string } | null>;
  /** Injected so tests can drive the YouTube path without a network fetch. */
  fetchYouTube?: (url: string) => Promise<TranscriptInput | null>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleSegmentRequest(
  request: Request,
  deps:    SegmentHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(request);

  if (deps.rateLimitKv) {
    const key = session
      ? `tsegment:user:${session.userId}`
      : `tsegment:ip:${request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'}`;
    const cap   = session ? deps.userDailyCap : deps.anonDailyCap;
    const quota = await checkAndIncrementQuota(deps.rateLimitKv, key, cap);
    if (!quota.allowed) {
      return json({
        ok:    false,
        error: {
          code:    'RATE_LIMITED',
          message: session
            ? `That is all ${cap} transcripts today. It resets tomorrow.`
            : `That is all ${cap} transcripts today. Sign in (free) for more, or come back tomorrow.`,
        },
      });
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'SEGMENT_FAILED', message: 'Service unavailable' } }, 503);
  }

  let input: TranscriptInput | null = null;
  if (parsed.data.kind === 'youtube') {
    input = await (deps.fetchYouTube ?? fetchYouTubeTranscript)(parsed.data.url);
    if (!input) {
      return json({ ok: false, error: { code: 'NO_CAPTIONS', message: 'Could not read captions for that video. It may be private, age-restricted, or have captions turned off. Paste the transcript text instead.' } }, 400);
    }
    if (parsed.data.title) input.title = parsed.data.title;
  } else if (parsed.data.kind === 'srt') {
    input = fromSrt(parsed.data.srt, parsed.data.title);
    if (!input) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Could not read those SRT captions. Check the format, or paste the transcript as plain text.' } }, 400);
    }
  } else {
    input = fromPlainText(parsed.data.text, parsed.data.title);
  }

  try {
    const { segmentation, argumentSegments, inputTokens, outputTokens } =
      await segmentTranscript(input, { provider: deps.provider, apiKey: deps.geminiApiKey });

    return json({
      ok:        true,
      title:     input.title,
      sourceUrl: input.sourceUrl,
      segments:  forClient(argumentSegments),
      // Say what was left out rather than quietly showing four rows from an
      // hour of audio and letting the reader assume that was all of it.
      excluded: {
        count: Math.max(0, segmentation.totalSegments - argumentSegments.length),
        total: segmentation.totalSegments,
      },
      notes: segmentation.notes,
      usage: { inputTokens, outputTokens },
    });
  } catch (err) {
    console.error('[transcript-segments] error:', err instanceof Error ? err.message : err);
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'SEGMENT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    return json({ ok: false, error: { code: 'SEGMENT_FAILED', message: 'Could not read that transcript' } }, 500);
  }
}
