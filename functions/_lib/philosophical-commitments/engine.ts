import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RawPhilosophicalCommitmentsResultSchema } from './schemas';
import { COMMITMENTS_SYSTEM_PROMPT } from './prompts';
import { COMMITMENTS_MODEL, COMMITMENTS_THINKING_BUDGET } from './constants';
import type { PhilosophicalCommitmentsResult, CommitmentsDeps } from './types';
import { interpretive, bandFromLegacyConfidence, type GroundednessSignal } from '../grounded/types';

type RawCommitmentsResult = z.infer<typeof RawPhilosophicalCommitmentsResultSchema>;

function inject<T extends { confidence: number } | null>(
  d: T,
): T extends null ? null : Omit<NonNullable<T>, 'confidence'> & { groundedness: GroundednessSignal; _debugConfidence?: number } {
  if (d === null) return null as any;
  const { confidence, ...rest } = d;
  return {
    ...rest,
    groundedness:     interpretive(bandFromLegacyConfidence(confidence)),
    _debugConfidence: confidence,
  } as any;
}

function applyGroundedness(raw: RawCommitmentsResult): PhilosophicalCommitmentsResult {
  return {
    ethical:        inject(raw.ethical),
    epistemic:      inject(raw.epistemic),
    political:      inject(raw.political),
    methodological: inject(raw.methodological),
    alternativePerspectives: raw.alternativePerspectives,
    notes: raw.notes,
  } as PhilosophicalCommitmentsResult;
}

export async function detectCommitments(
  text: string,
  deps: CommitmentsDeps,
): Promise<{ result: PhilosophicalCommitmentsResult; inputTokens: number; outputTokens: number }> {
  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry<RawCommitmentsResult>(
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
    RawPhilosophicalCommitmentsResultSchema,
    'philosophical-commitments',
    deps.backoffDelaysMs,
  );

  return { result: applyGroundedness(rawOutput), inputTokens, outputTokens };
}
