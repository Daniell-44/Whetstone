import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RawPresuppositionResultSchema } from './schemas';
import { PRESUP_SYSTEM_PROMPT, buildPresupPrompt } from './prompts';
import { PRESUP_MODEL, PRESUP_THINKING_BUDGET } from './constants';
import type { PresuppositionResult, PresuppositionDeps } from './types';
import { interpretive, bandFromLegacyConfidence, bandFromContestability } from '../grounded/types';

type RawPresuppositionResult = z.infer<typeof RawPresuppositionResultSchema>;

function applyGroundedness(raw: RawPresuppositionResult): PresuppositionResult {
  return {
    audienceProfile: raw.audienceProfile,
    notes:           raw.notes,
    presuppositions: raw.presuppositions.map(({ confidence, readingContestability, ...rest }) => ({
      ...rest,
      // Path-1: prefer the model's direct contestability rating; fall back to
      // the legacy confidence bridge only if it wasn't emitted.
      groundedness:     readingContestability
        ? interpretive(bandFromContestability(readingContestability))
        : interpretive(bandFromLegacyConfidence(confidence)),
      _debugConfidence: confidence,
    })),
  };
}

function filterValidQuotes(result: PresuppositionResult, text: string) {
  const valid = result.presuppositions.filter((p) => text.includes(p.triggerPassage));
  const dropped = result.presuppositions.length - valid.length;
  return { result: { ...result, presuppositions: valid }, dropped };
}

export async function detectPresuppositions(
  text: string,
  deps: PresuppositionDeps,
): Promise<{ result: PresuppositionResult; inputTokens: number; outputTokens: number }> {
  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry<RawPresuppositionResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.model ?? PRESUP_MODEL,
          systemInstruction: PRESUP_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildPresupPrompt(text) }],
          responseFormat:    'json',
          thinkingBudget:    PRESUP_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    RawPresuppositionResultSchema,
    'presupposition',
    deps.backoffDelaysMs,
  );

  const grounded = applyGroundedness(rawOutput);
  const { result: filtered, dropped } = filterValidQuotes(grounded, text);
  if (dropped > 0) console.warn(`[presupposition] dropped ${dropped} finding(s) with non-verbatim triggerPassage`);
  return { result: filtered, inputTokens, outputTokens };
}
