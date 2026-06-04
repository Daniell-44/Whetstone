import { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { StructuralValidityResultSchema } from './schemas';
import { VALIDITY_SYSTEM_PROMPT, buildValidityPrompt } from './prompts';
import { VALIDITY_MODEL, VALIDITY_THINKING_BUDGET } from './constants';
import type { StructuralValidityResult, StructuralValidityDeps } from './types';

export async function assessValidity(
  text: string,
  deps: StructuralValidityDeps,
): Promise<{ result: StructuralValidityResult; inputTokens: number; outputTokens: number }> {
  const { output, inputTokens, outputTokens } = await callWithRetry<StructuralValidityResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'synthesize',
          model:             deps.model ?? VALIDITY_MODEL,
          systemInstruction: VALIDITY_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildValidityPrompt(text) }],
          responseFormat:    'json',
          thinkingBudget:    VALIDITY_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    StructuralValidityResultSchema as z.ZodType<StructuralValidityResult>,
    'structural-validity',
    deps.backoffDelaysMs,
  );

  return { result: output, inputTokens, outputTokens };
}
