import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RhetoricalModeResultSchema } from './schemas';
import { RHET_SYSTEM_PROMPT, buildRhetPrompt } from './prompts';
import { RHET_MODEL, RHET_THINKING_BUDGET } from './constants';
import type { RhetoricalModeResult, RhetoricalModeDeps } from './types';
import { interpretive } from '../grounded/types';

type RawRhetResult = z.infer<typeof RhetoricalModeResultSchema>;

// Inject groundedness — rhetorical mode is an interpretive verdict.
function applyGroundedness(raw: RawRhetResult): RhetoricalModeResult {
  return { ...raw, groundedness: interpretive('medium') };
}

function filterValidQuotes(
  result: RhetoricalModeResult,
  text:   string,
): { result: RhetoricalModeResult; dropped: number } {
  const valid = result.moves.filter((m) => text.includes(m.passage));
  const dropped = result.moves.length - valid.length;
  return { result: { ...result, moves: valid }, dropped };
}

/** Normalise balance percentages to sum exactly to 100. */
function normaliseBalance(r: RhetoricalModeResult): RhetoricalModeResult {
  const { ethosPercent, pathosPercent, logosPercent } = r.balance;
  const sum = ethosPercent + pathosPercent + logosPercent;
  if (sum === 100 || sum === 0) return r;
  return {
    ...r,
    balance: {
      ethosPercent:  Math.round((ethosPercent  / sum) * 100),
      pathosPercent: Math.round((pathosPercent / sum) * 100),
      logosPercent:  Math.round((logosPercent  / sum) * 100),
    },
  };
}

export async function detectRhetoricalMode(
  text: string,
  deps: RhetoricalModeDeps,
): Promise<{ result: RhetoricalModeResult; inputTokens: number; outputTokens: number }> {
  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry<RawRhetResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.model ?? RHET_MODEL,
          systemInstruction: RHET_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildRhetPrompt(text) }],
          responseFormat:    'json',
          thinkingBudget:    RHET_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    RhetoricalModeResultSchema,
    'rhetorical-mode',
    deps.backoffDelaysMs,
  );

  const grounded = applyGroundedness(rawOutput);
  const normalised = normaliseBalance(grounded);
  const { result: filtered, dropped } = filterValidQuotes(normalised, text);
  if (dropped > 0) {
    console.warn(`[rhetorical-mode] dropped ${dropped} move(s) with non-verbatim passages`);
  }
  return { result: filtered, inputTokens, outputTokens };
}
