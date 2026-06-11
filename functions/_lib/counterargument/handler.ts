import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { generateCounterarguments } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  text: z.string()
    .min(50, 'Text must be at least 50 characters')
    .max(10_000, 'Text must be at most 10,000 characters'),
});

// ---------------------------------------------------------------------------
// Dependencies — all injectable for testing
// ---------------------------------------------------------------------------

export interface CounterargHandlerDeps {
  rateLimitKv:         RateLimitKV | undefined;
  geminiApiKey:        string | undefined;
  counterargDailyCap:  number;
  provider:            LlmProvider;
  getSession:          (request: Request) => Promise<{ userId: string } | null>;
  checkSubscription:   (userId: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleCounterargRequest(
  request: Request,
  deps:    CounterargHandlerDeps,
): Promise<Response> {

  // Auth gate — session required.
  const session = await deps.getSession(request);
  if (!session) {
    return json({
      ok:    false,
      error: { code: 'UNAUTHORIZED', message: 'Sign in to use Studio' },
    }, 401);
  }

  // Per-user rate limit keyed by user ID.
  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(
      deps.rateLimitKv,
      `counterarg:user:${session.userId}`,
      deps.counterargDailyCap,
    );
    if (!quota.allowed) {
      return json({
        ok:    false,
        error: { code: 'RATE_LIMITED', message: 'Daily Studio limit reached — try again tomorrow.' },
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

  // Run counterargument generation.
  try {
    const { result, inputTokens, outputTokens } = await generateCounterarguments(
      parsed.data.text,
      { provider: deps.provider, apiKey: deps.geminiApiKey },
    );
    return json({
      ok:    true,
      result,
      usage: { inputTokens, outputTokens },
    });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Counterargument generation failed';
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message } }, 500);
  }
}
