import { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { TonePostureResultSchema } from './schemas';
import { TONE_SYSTEM_PROMPT, buildTonePrompt } from './prompts';
import { TONE_MODEL, TONE_THINKING_BUDGET } from './constants';
import type { TonePostureResult, TonePostureDeps } from './types';

export async function detectTonePosture(
  text: string,
  deps: TonePostureDeps,
): Promise<{ result: TonePostureResult; inputTokens: number; outputTokens: number }> {
  const { output, inputTokens, outputTokens } = await callWithRetry<TonePostureResult>(
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
    TonePostureResultSchema as z.ZodType<TonePostureResult>,
    'tone-posture',
    deps.backoffDelaysMs,
  );

  return { result: output, inputTokens, outputTokens };
}
