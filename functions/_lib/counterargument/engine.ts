import { callWithRetry } from '../llm/retry';
import { CounterargumentResultSchema } from './schemas';
import { COUNTERARG_SYSTEM_PROMPT, buildCounterargPrompt } from './prompts';
import { COUNTERARG_MODEL, COUNTERARG_THINKING_BUDGET, COUNTERARG_TEMPERATURE, COUNTERARG_MAX_TOKENS } from './constants';
import type { CounterargumentResult, CounterargDeps } from './types';

export async function generateCounterarguments(
  text: string,
  deps: CounterargDeps,
): Promise<{ result: CounterargumentResult; inputTokens: number; outputTokens: number }> {
  const { output, inputTokens, outputTokens } = await callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'synthesize',
          model:             deps.model ?? COUNTERARG_MODEL,
          systemInstruction: COUNTERARG_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildCounterargPrompt(text) }],
          responseFormat:    'json',
          temperature:       COUNTERARG_TEMPERATURE,
          maxTokens:         COUNTERARG_MAX_TOKENS,
          thinkingBudget:    COUNTERARG_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    CounterargumentResultSchema,
    'counterargument',
    deps.backoffDelaysMs,
  );

  return { result: output, inputTokens, outputTokens };
}
