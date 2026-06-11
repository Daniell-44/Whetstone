import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RawEpistemicHumilityResultSchema } from './schemas';
import { HUMILITY_SYSTEM_PROMPT, buildHumilityPrompt } from './prompts';
import { HUMILITY_MODEL, HUMILITY_THINKING_BUDGET } from './constants';
import type { EpistemicHumilityResult, EpistemicHumilityDeps } from './types';
import { structural } from '../grounded/types';

type RawHumilityResult = z.infer<typeof RawEpistemicHumilityResultSchema>;

// Epistemic humility findings are STRUCTURAL — derivable by comparing the
// quoted certainty markers against the evidenceState assessment within the
// finding itself. Reader can verify by re-reading the quote.
function applyGroundedness(raw: RawHumilityResult): EpistemicHumilityResult {
  return {
    ...raw,
    findings: raw.findings.map(({ confidence, ...rest }) => ({
      ...rest,
      groundedness:     structural(),
      _debugConfidence: confidence,
    })),
  };
}

function filterValidQuotes(result: EpistemicHumilityResult, text: string) {
  const valid = result.findings.filter((f) => text.includes(f.passage));
  const dropped = result.findings.length - valid.length;
  return { result: { ...result, findings: valid }, dropped };
}

export async function detectEpistemicHumility(
  text: string,
  deps: EpistemicHumilityDeps,
): Promise<{ result: EpistemicHumilityResult; inputTokens: number; outputTokens: number }> {
  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry<RawHumilityResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.model ?? HUMILITY_MODEL,
          systemInstruction: HUMILITY_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildHumilityPrompt(text) }],
          responseFormat:    'json',
          thinkingBudget:    HUMILITY_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    RawEpistemicHumilityResultSchema,
    'epistemic-humility',
    deps.backoffDelaysMs,
  );

  const grounded = applyGroundedness(rawOutput);
  const { result: filtered, dropped } = filterValidQuotes(grounded, text);
  if (dropped > 0) console.warn(`[epistemic-humility] dropped ${dropped} finding(s) with non-verbatim passages`);
  return { result: filtered, inputTokens, outputTokens };
}
