import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { detectDisagreementEngagement } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

const BodySchema = z.object({
  text: z.string().min(50, 'Text must be at least 50 characters').max(10_000, 'Text must be at most 10,000 characters'),
});

export interface DisagreeHandlerDeps {
  rateLimitKv:       RateLimitKV | undefined;
  geminiApiKey:      string | undefined;
  disagreeDailyCap:  number;
  provider:          LlmProvider;
  getSession:        (request: Request) => Promise<{ userId: string } | null>;
  checkSubscription: (userId: string) => Promise<boolean>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleDisagreeRequest(request: Request, deps: DisagreeHandlerDeps): Promise<Response> {
  const session = await deps.getSession(request);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(deps.rateLimitKv, `disagree:user:${session.userId}`, deps.disagreeDailyCap);
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily disagreement-engagement limit reached — try again tomorrow.' } });
    }
  }

  let rawBody: unknown;
  try { rawBody = await request.json(); }
  catch { return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, 400); }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  if (!deps.geminiApiKey) return json({ ok: false, error: { code: 'DISAGREE_FAILED', message: 'Service unavailable' } }, 503);

  try {
    const { result, inputTokens, outputTokens } = await detectDisagreementEngagement(parsed.data.text, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    return json({ ok: true, result, usage: { inputTokens, outputTokens } });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'DISAGREE_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Disagreement-engagement analysis failed';
    return json({ ok: false, error: { code: 'DISAGREE_FAILED', message } }, 500);
  }
}
