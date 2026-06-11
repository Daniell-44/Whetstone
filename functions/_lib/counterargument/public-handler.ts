import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { generateCounterarguments } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

// ---------------------------------------------------------------------------
// PUBLIC counterargument generator
//
// Difference from the Studio handler: no subscription gate. IP-based daily
// rate limit (default 5/day) so casual readers can experience the engine
// without paying. Paid users (with cookie session) get a higher cap.
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  text: z.string()
    .min(50,     'Text must be at least 50 characters')
    .max(10_000, 'Text must be at most 10,000 characters'),
});

export interface PublicCounterargDeps {
  rateLimitKv:                RateLimitKV | undefined;
  geminiApiKey:               string | undefined;
  publicCounterargDailyCap:   number;
  loggedInCounterargDailyCap: number;
  provider:                   LlmProvider;
  getSession:                 (request: Request) => Promise<{ userId: string } | null>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handlePublicCounterargRequest(
  request: Request,
  deps:    PublicCounterargDeps,
): Promise<Response> {
  const session = await deps.getSession(request);

  // Rate limit: logged-in users get higher cap, anonymous IP-based
  if (deps.rateLimitKv) {
    if (session) {
      const quota = await checkAndIncrementQuota(
        deps.rateLimitKv,
        `counterarg-public:user:${session.userId}`,
        deps.loggedInCounterargDailyCap,
      );
      if (!quota.allowed) {
        return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily limit reached — try again tomorrow.' } });
      }
    } else {
      const ip =
        request.headers.get('CF-Connecting-IP') ??
        request.headers.get('X-Forwarded-For')  ??
        'unknown';
      const quota = await checkAndIncrementQuota(
        deps.rateLimitKv,
        `counterarg-public:ip:${ip}`,
        deps.publicCounterargDailyCap,
      );
      if (!quota.allowed) {
        return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'You\'ve hit today\'s free limit. Sign in for more, or come back tomorrow.' } });
      }
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
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service unavailable' } }, 503);
  }

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
