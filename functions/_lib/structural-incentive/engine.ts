import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RawStructuralIncentiveResultSchema } from './schemas';
import { SI_SYSTEM_PROMPT, buildSiPrompt } from './prompts';
import { SI_MODEL, SI_THINKING_BUDGET } from './constants';
import type { StructuralIncentiveResult, StructuralIncentiveDeps } from './types';
import { interpretive, bandFromLegacyConfidence } from '../grounded/types';

type RawStructuralIncentiveResult = z.infer<typeof RawStructuralIncentiveResultSchema>;

function applyGroundedness(raw: RawStructuralIncentiveResult): StructuralIncentiveResult {
  return {
    ...raw,
    alignments: raw.alignments.map(({ confidence, ...rest }) => ({
      ...rest,
      groundedness:     interpretive(bandFromLegacyConfidence(confidence)),
      _debugConfidence: confidence,
    })),
  };
}

function filterValidQuotes(result: StructuralIncentiveResult, text: string) {
  const valid = result.alignments.filter((a) => text.includes(a.triggerPassage));
  const dropped = result.alignments.length - valid.length;
  return { result: { ...result, alignments: valid }, dropped };
}

export async function detectStructuralIncentives(
  text: string,
  deps: StructuralIncentiveDeps,
): Promise<{ result: StructuralIncentiveResult; inputTokens: number; outputTokens: number }> {
  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry<RawStructuralIncentiveResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.model ?? SI_MODEL,
          systemInstruction: SI_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildSiPrompt(text) }],
          responseFormat:    'json',
          thinkingBudget:    SI_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    RawStructuralIncentiveResultSchema,
    'structural-incentive',
    deps.backoffDelaysMs,
  );

  const grounded = applyGroundedness(rawOutput);
  const { result: filtered, dropped } = filterValidQuotes(grounded, text);
  if (dropped > 0) console.warn(`[structural-incentive] dropped ${dropped} alignment(s) with non-verbatim passages`);
  return { result: filtered, inputTokens, outputTokens };
}
