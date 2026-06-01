import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { extractArgument } from './engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

const BodySchema = z.object({
  text: z.string()
    .min(50,     'Text must be at least 50 characters')
    .max(20_000, 'Text must be at most 20,000 characters'),
});

export interface ExtractionHandlerDeps {
  rateLimitKv:          RateLimitKV | undefined;
  geminiApiKey:         string | undefined;
  extractionDailyCap:   number;
  extractionUserDailyCap?: number;
  provider:             LlmProvider;
  getSession?:          (request: Request) => Promise<{ userId: string } | null>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleExtractionRequest(
  request: Request,
  deps:    ExtractionHandlerDeps,
): Promise<Response> {

  const session = deps.getSession ? await deps.getSession(request) : null;

  if (deps.rateLimitKv) {
    if (session) {
      const quota = await checkAndIncrementQuota(
        deps.rateLimitKv,
        `extract:user:${session.userId}`,
        deps.extractionUserDailyCap ?? 50,
      );
      if (!quota.allowed) {
        return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily extraction limit reached — try again tomorrow.' } });
      }
    } else {
      const ip =
        request.headers.get('CF-Connecting-IP') ??
        request.headers.get('X-Forwarded-For')  ??
        'unknown';
      const quota = await checkAndIncrementQuota(
        deps.rateLimitKv,
        `extract:ip:${ip}`,
        deps.extractionDailyCap,
      );
      if (!quota.allowed) {
        return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily extraction limit reached — try again tomorrow.' } });
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
    return json({ ok: false, error: { code: 'EXTRACTION_FAILED', message: 'Service unavailable' } }, 503);
  }

  try {
    const { result, inputTokens, outputTokens } = await extractArgument(parsed.data.text, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    return json({
      ok:         true,
      extraction: result,
      usage:      { inputTokens, outputTokens },
    });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'EXTRACTION_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return json({ ok: false, error: { code: 'EXTRACTION_FAILED', message } }, 500);
  }
}
