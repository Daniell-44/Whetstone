import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { assessEvidenceWeighted } from './engine';
import type { ClaimInput } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const CLAIM_TYPES = [
  'empirical_contested',
  'empirical_uncontested',
  'normative',
  'definitional',
  'modal_predictive',
] as const;

const ClaimSchema = z.object({
  id:        z.string().min(1),
  text:      z.string().min(1),
  claimType: z.enum(CLAIM_TYPES),
});

const BodySchema = z.object({
  claims: z.array(ClaimSchema).min(1).max(20),
});

// ---------------------------------------------------------------------------
// Handler deps
// ---------------------------------------------------------------------------

export interface EvidenceHandlerDeps {
  rateLimitKv:        RateLimitKV | undefined;
  geminiApiKey:       string | undefined;
  evidenceDailyCap:   number;
  provider:           LlmProvider;
  getSession:         (request: Request) => Promise<{ userId: string } | null>;
  /** No longer called: the free-tier decision (2026-08-14) made the
      subscription gate moot. Kept so endpoint wiring keeps compiling. */
  checkSubscription:  (userId: string) => Promise<boolean>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleEvidenceRequest(
  request: Request,
  deps:    EvidenceHandlerDeps,
): Promise<Response> {

  // Session is optional since the free-tier decision (2026-08-14): every
  // feature runs for anonymous callers, and the endpoint wraps this handler
  // in the anonymous session gate (three runs per browser session, then
  // sign-in), so the handler itself no longer turns anyone away.
  const session = await deps.getSession(request);

  // Rate limit: keyed per user for signed-in callers, per IP for anonymous
  // ones (the same key shape the Reader's audit handler uses). Both share the
  // same daily cap.
  if (deps.rateLimitKv) {
    const key = session
      ? `evidence:user:${session.userId}`
      : `evidence:ip:${request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'}`;
    const quota = await checkAndIncrementQuota(
      deps.rateLimitKv,
      key,
      deps.evidenceDailyCap,
    );
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily evidence check limit reached — try again tomorrow.' } });
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
    return json({
      ok:    false,
      error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
    }, 400);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'EVIDENCE_FAILED', message: 'Service unavailable' } }, 503);
  }

  try {
    const claims: ClaimInput[] = parsed.data.claims;
    const { result, inputTokens, outputTokens } = await assessEvidenceWeighted(claims, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    return json({
      ok:    true,
      result,
      usage: { inputTokens, outputTokens },
    });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'EVIDENCE_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Evidence-weighted assessment failed';
    return json({ ok: false, error: { code: 'EVIDENCE_FAILED', message } }, 500);
  }
}
