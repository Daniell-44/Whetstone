import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { detectRhetoricalMode } from './engine';
import { checkAndIncrementQuota, quotaIdentity } from '../rate-limit';
import { waitPhrase } from '../billing/limits';
import type { RateLimitKV } from '../rate-limit';

const BodySchema = z.object({
  text: z.string().min(50, 'Text must be at least 50 characters').max(10_000, 'Text must be at most 10,000 characters'),
});

export interface RhetHandlerDeps {
  rateLimitKv:       RateLimitKV | undefined;
  geminiApiKey:      string | undefined;
  rhetDailyCap:      number;
  provider:          LlmProvider;
  getSession:        (request: Request) => Promise<{ userId: string } | null>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleRhetRequest(request: Request, deps: RhetHandlerDeps): Promise<Response> {
  const session = await deps.getSession(request);
  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(deps.rateLimitKv, `rhet:${quotaIdentity(request, session?.userId)}`, deps.rhetDailyCap, 'rolling24h');
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: `You've reached the rhetorical-mode analysis limit. It reopens ${waitPhrase(quota.resetAt)}.`, resetAt: quota.resetAt } });
    }
  }

  let rawBody: unknown;
  try { rawBody = await request.json(); }
  catch { return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, 400); }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  if (!deps.geminiApiKey) return json({ ok: false, error: { code: 'RHET_FAILED', message: 'Service unavailable' } }, 503);

  try {
    const { result, inputTokens, outputTokens } = await detectRhetoricalMode(parsed.data.text, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    return json({ ok: true, result, usage: { inputTokens, outputTokens } });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'RHET_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Rhetorical-mode analysis failed';
    return json({ ok: false, error: { code: 'RHET_FAILED', message } }, 500);
  }
}
