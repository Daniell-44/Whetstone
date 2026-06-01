import { callWithRetry } from '../llm/retry';
import { ArgumentExtractionResultSchema } from './schemas';
import { EXTRACTION_SYSTEM_PROMPT } from './prompts';
import { EXTRACTION_MODEL, EXTRACTION_THINKING_BUDGET } from './constants';
import type { ArgumentExtractionResult, ExtractionDeps } from './types';

export async function extractArgument(
  text: string,
  deps: ExtractionDeps,
): Promise<{ result: ArgumentExtractionResult; inputTokens: number; outputTokens: number }> {
  const { output, inputTokens, outputTokens } = await callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'synthesize',
          model:             deps.model ?? EXTRACTION_MODEL,
          systemInstruction: EXTRACTION_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: text }],
          responseFormat:    'json',
          thinkingBudget:    EXTRACTION_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    ArgumentExtractionResultSchema,
    'argument-extraction',
    deps.backoffDelaysMs,
  );

  return { result: output, inputTokens, outputTokens };
}
