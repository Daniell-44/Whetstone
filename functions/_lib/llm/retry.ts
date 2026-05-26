// Shared retry / backoff helper used by both the scorecard engine and the
// audit engine. Extracted here so both engines stay in sync on retry policy
// without duplicating the logic.

import { z }             from 'zod';
import { ProviderError } from '../providers/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extractJson(text: string): string {
  // Strip markdown code fences if the model added them despite JSON mode.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced ? fenced[1]! : text.trim();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// callWithRetry
//
// Three failure modes, treated differently:
//   1. Retryable provider error (5xx overload, rate-limit, network) →
//      retry up to (backoffDelaysMs.length + 1) total attempts, waiting
//      progressively longer between each (~2 s / 6 s / 15 s by default).
//   2. Malformed / invalid JSON from the model →
//      retry once immediately (no delay).
//   3. Hard error (4xx, bad request, auth) → fail fast, no retry.
//
// Override backoffDelaysMs with near-zero values in tests to keep them fast.
// ---------------------------------------------------------------------------

export const DEFAULT_BACKOFF_DELAYS_MS = [2_000, 6_000, 15_000] as const;

export interface CallResult<T> {
  output:       T;
  inputTokens:  number;
  outputTokens: number;
}

export async function callWithRetry<T>(
  makeRequest: () => Promise<{ content: string; inputTokens: number; outputTokens: number }>,
  schema: z.ZodType<T>,
  stageName: string,
  backoffDelaysMs: readonly number[] = DEFAULT_BACKOFF_DELAYS_MS,
): Promise<CallResult<T>> {
  const maxAttempts = backoffDelaysMs.length + 1;
  let lastRetryableError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(backoffDelaysMs[attempt - 1]!);
    }

    let lastValidationError = 'unknown';

    // Inner loop: try the request, then validate. Retries once immediately
    // on bad model output (no delay) before breaking to the outer loop.
    for (let jsonAttempt = 0; jsonAttempt < 2; jsonAttempt++) {
      let res: { content: string; inputTokens: number; outputTokens: number };
      try {
        res = await makeRequest();
      } catch (err) {
        if (err instanceof ProviderError && err.retryable) {
          lastRetryableError = err;
          break; // break inner, continue outer with backoff
        }
        throw err; // hard error — propagate immediately
      }

      try {
        const parsed = schema.safeParse(JSON.parse(extractJson(res.content)));
        if (parsed.success) {
          return { output: parsed.data, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
        }
        lastValidationError = parsed.error.message;
      } catch (e) {
        lastValidationError = e instanceof Error ? e.message : 'JSON parse error';
      }

      if (jsonAttempt === 1) {
        throw new Error(
          `Stage "${stageName}" failed JSON validation after 2 attempts: ${lastValidationError}`,
        );
      }
      // jsonAttempt === 0: retry immediately for bad output
    }
  }

  // All backoff attempts exhausted.
  if (lastRetryableError instanceof ProviderError) {
    throw new ProviderError(
      lastRetryableError.kind,
      `Stage "${stageName}" failed after ${maxAttempts} attempts (last: ${lastRetryableError.message})`,
      lastRetryableError.status,
      false,
    );
  }
  throw new Error(`Stage "${stageName}" exhausted all ${maxAttempts} retry attempts`);
}
