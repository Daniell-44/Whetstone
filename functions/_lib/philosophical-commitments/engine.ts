import { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { PhilosophicalCommitmentsResultSchema } from './schemas';
import { COMMITMENTS_SYSTEM_PROMPT } from './prompts';
import { COMMITMENTS_MODEL, COMMITMENTS_THINKING_BUDGET } from './constants';
import type { PhilosophicalCommitmentsResult, CommitmentsDeps } from './types';

export async function detectCommitments(
  text: string,
  deps: CommitmentsDeps,
): Promise<{ result: PhilosophicalCommitmentsResult; inputTokens: number; outputTokens: number }> {
  const { output, inputTokens, outputTokens } = await callWithRetry<PhilosophicalCommitmentsResult>(
    () =>
      deps.provider.complete(
        {
          operation:         'synthesize',
          model:             deps.model ?? COMMITMENTS_MODEL,
          systemInstruction: COMMITMENTS_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: text }],
          responseFormat:    'json',
          thinkingBudget:    COMMITMENTS_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    PhilosophicalCommitmentsResultSchema as z.ZodType<PhilosophicalCommitmentsResult>,
    'philosophical-commitments',
    deps.backoffDelaysMs,
  );

  return { result: output, inputTokens, outputTokens };
}
