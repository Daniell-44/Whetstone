import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { auditTranscript } from './engine';
import { fetchYouTubeTranscript, fromPlainText, fromSrt } from './youtube';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';
import type { TranscriptInput } from './types';

const BodySchema = z.union([
  z.object({ kind: z.literal('youtube'),     url: z.string().url(),      title: z.string().optional() }),
  z.object({ kind: z.literal('text'),        text: z.string().min(200),  title: z.string().optional() }),
  z.object({ kind: z.literal('srt'),         srt:  z.string().min(50),   title: z.string().optional() }),
]);

export interface TranscriptHandlerDeps {
  rateLimitKv:        RateLimitKV | undefined;
  geminiApiKey:       string | undefined;
  transcriptDailyCap: number;
  provider:           LlmProvider;
  getSession:         (request: Request) => Promise<{ userId: string } | null>;
  checkSubscription:  (userId: string) => Promise<boolean>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleTranscriptRequest(
  request: Request,
  deps:    TranscriptHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(request);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);
  }

  const hasSub = await deps.checkSubscription(session.userId);
  if (!hasSub) {
    return json({ ok: false, error: { code: 'SUBSCRIPTION_REQUIRED', message: 'Studio subscription required for transcript audits.' } }, 402);
  }

  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(
      deps.rateLimitKv,
      `transcript:user:${session.userId}`,
      deps.transcriptDailyCap,
    );
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily transcript audit limit reached — try again tomorrow.' } });
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
    return json({ ok: false, error: { code: 'TRANSCRIPT_FAILED', message: 'Service unavailable' } }, 503);
  }

  // Build TranscriptInput from the input variant
  let input: TranscriptInput | null = null;
  if (parsed.data.kind === 'youtube') {
    input = await fetchYouTubeTranscript(parsed.data.url);
    if (!input) {
      return json({ ok: false, error: { code: 'TRANSCRIPT_FAILED', message: 'Could not fetch captions for that video. The video may be private, age-restricted, or have captions disabled. Paste the transcript directly instead.' } }, 400);
    }
    if (parsed.data.title) input.title = parsed.data.title;
  } else if (parsed.data.kind === 'srt') {
    input = fromSrt(parsed.data.srt, parsed.data.title);
    if (!input) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Could not parse SRT captions. Make sure the format is valid.' } }, 400);
    }
  } else {
    input = fromPlainText(parsed.data.text, parsed.data.title);
  }

  try {
    const { result, inputTokens, outputTokens } = await auditTranscript(input, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    return json({ ok: true, result, usage: { inputTokens, outputTokens } });
  } catch (err) {
    console.error('[transcript-audit] error:', err instanceof Error ? err.message : err);
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'TRANSCRIPT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Transcript audit failed';
    return json({ ok: false, error: { code: 'TRANSCRIPT_FAILED', message } }, 500);
  }
}
