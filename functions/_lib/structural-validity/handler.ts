import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { assessValidity } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

const BodySchema = z.object({
  text: z.string()
    .min(50,     'Text must be at least 50 characters')
    .max(10_000, 'Text must be at most 10,000 characters'),
});

export interface ValidityHandlerDeps {
  rateLimitKv:        RateLimitKV | undefined;
  geminiApiKey:       string | undefined;
  validityDailyCap:   number;
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

export async function handleValidityRequest(
  request: Request,
  deps:    ValidityHandlerDeps,
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
      ? `validity:user:${session.userId}`
      : `validity:ip:${request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'}`;
    const quota = await checkAndIncrementQuota(
      deps.rateLimitKv,
      key,
      deps.validityDailyCap,
    );
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily validity check limit reached — try again tomorrow.' } });
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
    return json({ ok: false, error: { code: 'VALIDITY_FAILED', message: 'Service unavailable' } }, 503);
  }

  try {
    const { result, inputTokens, outputTokens } = await assessValidity(parsed.data.text, {
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
      return json({ ok: false, error: { code: 'VALIDITY_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Structural validity check failed';
    return json({ ok: false, error: { code: 'VALIDITY_FAILED', message } }, 500);
  }
}
