import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import type { ExtractResult } from '../extract/article';
import { auditText } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';
import { resolveAuditQuota } from '../billing/limits';

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
  auditDailyCap:     number;        // legacy — superseded by resolveAuditQuota; kept for compat
  auditUserDailyCap?: number;       // legacy
  provider:          LlmProvider;
  extractor:         (url: string) => Promise<ExtractResult>;
  getSession?:       (request: Request) => Promise<{ userId: string } | null>;
  /** Whether the user has an active subscription — drives the paid monthly cap. */
  checkSubscription?: (userId: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Extraction error → user-friendly message
// ---------------------------------------------------------------------------

const EXTRACT_ERROR_MESSAGES: Record<string, string> = {
  EXTRACTION_FAILED: "This site blocks automated reading (many major news sites do). Copy the article text and paste it into the Text tab instead. The Whetstone browser extension can read these sites directly.",
  TOO_SHORT:         'The extracted text is too short (minimum 250 words). Paste the full article text into the Text tab instead.',
  NOT_HTML:          "That link does not point to a readable article page. Paste the text into the Text tab instead.",
  FETCH_FAILED:      "Could not reach that link, or the site blocks automated access (common for paywalled or protected news sites). Paste the article text into the Text tab instead.",
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
    // Resolve the tier-aware quota: free users get a small daily cap, paid
    // users get a larger monthly cap. The cap and period both come from the
    // single source of truth in billing/limits.ts.
    const hasSub = session && deps.checkSubscription
      ? await deps.checkSubscription(session.userId)
      : false;
    const quota = resolveAuditQuota(Boolean(session), hasSub);

    const key = session
      ? `audit:user:${session.userId}:${quota.period}`
      : `audit:ip:${request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'}`;

    const result = await checkAndIncrementQuota(deps.rateLimitKv, key, quota.cap, quota.period);
    if (!result.allowed) {
      const when = quota.period === 'month' ? 'this month' : 'today';
      const upsell = hasSub
        ? 'You can add another usage block from your account, or it resets next month.'
        : session
          ? 'Subscribe for a much higher monthly limit, or it resets tomorrow.'
          : 'Sign in for more daily audits, or subscribe for a monthly limit.';
      return json({
        ok:    false,
        error: { code: 'RATE_LIMITED', message: `You've used all ${quota.cap} audits ${when}. ${upsell}` },
      });
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
      // Include the input text the audit ran against so clients can fire
      // follow-up lens calls without re-extracting. Important for URL audits
      // where the client never had the text. Capped because URL extractions
      // can be long.
      sourceText: inputText.slice(0, 10_000),
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
