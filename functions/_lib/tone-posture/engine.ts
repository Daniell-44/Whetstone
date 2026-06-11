import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RawTonePostureResultSchema } from './schemas';
import { TONE_SYSTEM_PROMPT, buildTonePrompt } from './prompts';
import { TONE_MODEL, TONE_THINKING_BUDGET } from './constants';
import type { TonePostureResult, TonePostureDeps } from './types';
import { interpretive, bandFromLegacyConfidence } from '../grounded/types';

type RawToneResult = z.infer<typeof RawTonePostureResultSchema>;

function applyGroundedness(raw: RawToneResult): TonePostureResult {
  const { confidence, ...rest } = raw;
  return {
    ...rest,
    tonalMoves: rest.tonalMoves.map(({ confidence: mc, ...mRest }) => ({
      ...mRest,
      groundedness:     interpretive(bandFromLegacyConfidence(mc)),
      _debugConfidence: mc,
    })),
    groundedness:     interpretive(bandFromLegacyConfidence(confidence)),
    _debugConfidence: confidence,
  };
}

export async function detectTonePosture(
  text: string,
  deps: TonePostureDeps,
): Promise<{ result: TonePostureResult; inputTokens: number; outputTokens: number }> {
  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry<RawToneResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.model ?? TONE_MODEL,
          systemInstruction: TONE_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildTonePrompt(text) }],
          responseFormat:    'json',
          thinkingBudget:    TONE_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    RawTonePostureResultSchema,
    'tone-posture',
    deps.backoffDelaysMs,
  );

  return { result: applyGroundedness(rawOutput), inputTokens, outputTokens };
}
