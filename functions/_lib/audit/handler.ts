import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import type { ExtractResult } from '../extract/article';
import { auditText } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const TextBodySchema = z.object({
  text: z.string()
    .min(50, 'Text must be at least 50 characters')
    .max(10_000, 'Text must be at most 10,000 characters'),
  url: z.undefined().optional(),
});

const UrlBodySchema = z.object({
  url: z.string().url(),
  text: z.undefined().optional(),
});

const BodySchema = z.union([TextBodySchema, UrlBodySchema]);

// ---------------------------------------------------------------------------
// Dependencies — all injectable for testing
// ---------------------------------------------------------------------------

export interface AuditHandlerDeps {
  rateLimitKv:       RateLimitKV | undefined;
  geminiApiKey:      string | undefined;
  auditDailyCap:     number;
  auditUserDailyCap?: number;
  provider:          LlmProvider;
  extractor:         (url: string) => Promise<ExtractResult>;
  getSession?:       (request: Request) => Promise<{ userId: string } | null>;
}

// ---------------------------------------------------------------------------
// Extraction error → user-friendly message
// ---------------------------------------------------------------------------

const EXTRACT_ERROR_MESSAGES: Record<string, string> = {
  EXTRACTION_FAILED: "Couldn't extract the article text from that URL. Try pasting the text directly using the Text tab.",
  TOO_SHORT:         'The extracted text is too short (minimum 250 words). Try pasting the full article text directly.',
  NOT_HTML:          "That URL doesn't point to an HTML page. Try pasting the text directly using the Text tab.",
  FETCH_FAILED:      "Couldn't reach that URL — check it's publicly accessible. You can paste the text directly instead.",
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleAuditRequest(
  request: Request,
  deps: AuditHandlerDeps,
): Promise<Response> {

  // Session check — authenticated users get a per-user rate limit instead of IP-based.
  const session = deps.getSession ? await deps.getSession(request) : null;

  if (deps.rateLimitKv) {
    if (session) {
      const quota = await checkAndIncrementQuota(
        deps.rateLimitKv,
        `audit:user:${session.userId}`,
        deps.auditUserDailyCap ?? 50,
      );
      if (!quota.allowed) {
        return json({
          ok:    false,
          error: { code: 'RATE_LIMITED', message: 'Daily audit limit reached — try again tomorrow.' },
        });
      }
    } else {
      // Anonymous: IP-based rate limit.
      const ip =
        request.headers.get('CF-Connecting-IP') ??
        request.headers.get('X-Forwarded-For')  ??
        'unknown';
      const quota = await checkAndIncrementQuota(
        deps.rateLimitKv,
        `audit:ip:${ip}`,
        deps.auditDailyCap,
      );
      if (!quota.allowed) {
        return json({
          ok:    false,
          error: { code: 'RATE_LIMITED', message: 'Daily audit limit reached — try again tomorrow.' },
        });
      }
    }
  }

  // Parse and validate body.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({
      ok:    false,
      error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
    }, 400);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service unavailable' } }, 503);
  }

  // Resolve the text to audit.
  const inputData = parsed.data as { text?: string; url?: string };
  let inputText: string;

  if (inputData.url !== undefined) {
    const extracted = await deps.extractor(inputData.url);
    if (!extracted.ok) {
      const message = EXTRACT_ERROR_MESSAGES[extracted.error.code] ?? extracted.error.message;
      return json({ ok: false, error: { code: extracted.error.code, message } });
    }
    inputText = extracted.article.text;
  } else {
    inputText = inputData.text!;
  }

  // Run the audit.
  try {
    const result = await auditText(inputText, {
      provider:       deps.provider,
      apiKey:         deps.geminiApiKey,
      includePhase2:  session !== null,
    });
    return json({
      ok:    true,
      audit: result.audit,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Audit failed';
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message } }, 500);
  }
}
