import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RawArgumentExtractionResultSchema } from './schemas';
import { EXTRACTION_SYSTEM_PROMPT } from './prompts';
import { EXTRACTION_MODEL, EXTRACTION_THINKING_BUDGET } from './constants';
import type { ArgumentExtractionResult, ExtractionDeps } from './types';
import { interpretive, bandFromLegacyConfidence } from '../grounded/types';

type RawExtractionResult = z.infer<typeof RawArgumentExtractionResultSchema>;

// Argument extraction is interpretive — the central claim and statement
// structure depend on a reading of the text.
function applyGroundedness(raw: RawExtractionResult): ArgumentExtractionResult {
  const { confidence, ...rest } = raw;
  return {
    ...rest,
    groundedness:     interpretive(bandFromLegacyConfidence(confidence)),
    _debugConfidence: confidence,
  };
}

export async function extractArgument(
  text: string,
  deps: ExtractionDeps,
): Promise<{ result: ArgumentExtractionResult; inputTokens: number; outputTokens: number }> {
  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry<RawExtractionResult>(
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
    RawArgumentExtractionResultSchema,
    'argument-extraction',
    deps.backoffDelaysMs,
  );

  return { result: applyGroundedness(rawOutput), inputTokens, outputTokens };
}
