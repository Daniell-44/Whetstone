import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import type { ExtractResult } from '../extract/article';
import { auditText } from './engine';
import { checkAndIncrementQuota, quotaIdentity } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';
import { resolveAuditQuota, waitPhrase } from '../billing/limits';
import { AUDIENCES, INTENTS } from './goals';

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const GoalsFields = {
  // Optional draft goals, tuning audit emphasis. The version-scoped route has
  // always accepted these; the direct endpoint needs them too now that the
  // Studio runs against it for signed-out writers.
  audience: z.enum(AUDIENCES).optional(),
  intent:   z.enum(INTENTS).optional(),
};

const TextBodySchema = z.object({
  text: z.string()
    .min(50, 'Text must be at least 50 characters')
    .max(10_000, 'Text must be at most 10,000 characters'),
  url: z.undefined().optional(),
  ...GoalsFields,
});

const UrlBodySchema = z.object({
  url: z.string().url(),
  text: z.undefined().optional(),
  ...GoalsFields,
});

const BodySchema = z.union([TextBodySchema, UrlBodySchema]);

// ---------------------------------------------------------------------------
// Dependencies — all injectable for testing
// ---------------------------------------------------------------------------

export interface AuditHandlerDeps {
  rateLimitKv:       RateLimitKV | undefined;
  geminiApiKey:      string | undefined;
  /** Operator override for the free allowance (env AUDIT_FREE_USES). */
  freeUseAllowance?: number;
  provider:          LlmProvider;
  extractor:         (url: string) => Promise<ExtractResult>;
  getSession?:       (request: Request) => Promise<{ userId: string } | null>;
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

  // Reported back on success so the tool can show what is left BEFORE someone
  // runs out. An unannounced wall feels like a trick; an announced one is just
  // a rule. Null when no KV is bound (local dev) — the UI then shows nothing
  // rather than inventing a number.
  let allowance: { remaining: number; cap: number; resetAt: string } | null = null;

  if (deps.rateLimitKv) {
    // One allowance for everyone, opening on the first audit and closing 24h
    // later. The cap and period come from billing/limits.ts; signing in only
    // moves the count from the client IP onto the account.
    const quota = resolveAuditQuota(deps.freeUseAllowance);
    const key   = `audit:${quotaIdentity(request, session?.userId)}`;

    const result = await checkAndIncrementQuota(deps.rateLimitKv, key, quota.cap, quota.period);
    if (!result.allowed) {
      return json({
        ok:    false,
        error: {
          code:    'RATE_LIMITED',
          message: `You've used all ${quota.cap} audits. The next one unlocks ${waitPhrase(result.resetAt)}.`,
          resetAt: result.resetAt,
        },
      });
    }
    allowance = { remaining: result.remaining, cap: quota.cap, resetAt: result.resetAt };
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
      // Phase 2 (key-term, referent and falsifiability lenses) used to be
      // signed-in only. The tool is open now, so every audit gets the full
      // lens suite; the 3-per-24h allowance is what bounds the extra cost.
      includePhase2:  true,
      // Both fields or neither — a half-specified pair tunes nothing.
      goals: parsed.data.audience && parsed.data.intent
        ? { audience: parsed.data.audience, intent: parsed.data.intent }
        : undefined,
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
      allowance,
    });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Audit failed';
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message } }, 500);
  }
}
