import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { detectPresuppositions } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

const BodySchema = z.object({
  text: z.string().min(50, 'Text must be at least 50 characters').max(10_000, 'Text must be at most 10,000 characters'),
});

export interface PresupHandlerDeps {
  rateLimitKv:       RateLimitKV | undefined;
  geminiApiKey:      string | undefined;
  presupDailyCap:    number;
  provider:          LlmProvider;
  getSession:        (request: Request) => Promise<{ userId: string } | null>;
  checkSubscription: (userId: string) => Promise<boolean>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handlePresupRequest(
  request: Request,
  deps:    PresupHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(request);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);
  }

  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(
      deps.rateLimitKv,
      `presup:user:${session.userId}`,
      deps.presupDailyCap,
    );
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily presupposition analysis limit reached — try again tomorrow.' } });
    }
  }

  let rawBody: unknown;
  try { rawBody = await request.json(); }
  catch { return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, 400); }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'PRESUP_FAILED', message: 'Service unavailable' } }, 503);
  }

  try {
    const { result, inputTokens, outputTokens } = await detectPresuppositions(parsed.data.text, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    return json({ ok: true, result, usage: { inputTokens, outputTokens } });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'PRESUP_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Presupposition analysis failed';
    return json({ ok: false, error: { code: 'PRESUP_FAILED', message } }, 500);
  }
}
