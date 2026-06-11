import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RawDisagreementEngagementResultSchema } from './schemas';
import { DISAGREE_SYSTEM_PROMPT, buildDisagreePrompt } from './prompts';
import { DISAGREE_MODEL, DISAGREE_THINKING_BUDGET } from './constants';
import type { DisagreementEngagementResult, DisagreementEngagementDeps } from './types';
import { interpretive, bandFromLegacyConfidence } from '../grounded/types';

type RawDisagreeResult = z.infer<typeof RawDisagreementEngagementResultSchema>;

function applyGroundedness(raw: RawDisagreeResult): DisagreementEngagementResult {
  return {
    ...raw,
    engagements: raw.engagements.map(({ confidence, ...rest }) => ({
      ...rest,
      groundedness:     interpretive(bandFromLegacyConfidence(confidence)),
      _debugConfidence: confidence,
    })),
  };
}

function filterValidQuotes(result: DisagreementEngagementResult, text: string) {
  const valid = result.engagements.filter((e) =>
    e.triggerPassage === null || text.includes(e.triggerPassage),
  );
  const dropped = result.engagements.length - valid.length;
  return { result: { ...result, engagements: valid }, dropped };
}

export async function detectDisagreementEngagement(
  text: string,
  deps: DisagreementEngagementDeps,
): Promise<{ result: DisagreementEngagementResult; inputTokens: number; outputTokens: number }> {
  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry<RawDisagreeResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.model ?? DISAGREE_MODEL,
          systemInstruction: DISAGREE_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildDisagreePrompt(text) }],
          responseFormat:    'json',
          thinkingBudget:    DISAGREE_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    RawDisagreementEngagementResultSchema,
    'disagreement-engagement',
    deps.backoffDelaysMs,
  );

  const grounded = applyGroundedness(rawOutput);
  const { result: filtered, dropped } = filterValidQuotes(grounded, text);
  if (dropped > 0) console.warn(`[disagreement-engagement] dropped ${dropped} engagement(s) with non-verbatim passages`);
  return { result: filtered, inputTokens, outputTokens };
}
