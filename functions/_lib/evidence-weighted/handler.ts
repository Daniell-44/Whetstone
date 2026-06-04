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

  const session = await deps.getSession(request);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);
  }

  const hasSubscription = await deps.checkSubscription(session.userId);
  if (!hasSubscription) {
    return json({ ok: false, error: { code: 'SUBSCRIPTION_REQUIRED', message: 'Active Studio subscription required.' } }, 402);
  }

  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(
      deps.rateLimitKv,
      `evidence:user:${session.userId}`,
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
