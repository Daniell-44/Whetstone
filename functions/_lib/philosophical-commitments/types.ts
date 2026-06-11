export type EthicalFramework =
  | 'consequentialist' | 'deontological' | 'virtue_ethics'
  | 'contractualist' | 'utilitarian' | 'pluralist' | 'unclear';

export type EpistemicCommitment =
  | 'empiricist' | 'rationalist' | 'experiential'
  | 'authoritative' | 'mixed' | 'unclear';

export type PoliticalFramework =
  | 'liberal' | 'libertarian' | 'communitarian' | 'conservative'
  | 'progressive' | 'socialist' | 'pluralist' | 'unclear';

export type MethodologicalCommitment =
  | 'reductionist' | 'holist' | 'individualist' | 'structuralist'
  | 'universalist' | 'contextualist' | 'mixed' | 'unclear';

import type { GroundednessSignal } from '../grounded/types';

export interface FrameworkDetection<T extends string> {
  framework:        T;
  evidence:         string;
  explanation:      string;
  groundedness:     GroundednessSignal;
  _debugConfidence?:number;
}

export type FrameworkType = 'ethical' | 'epistemic' | 'political' | 'methodological';

export interface AlternativePerspective {
  framework:     string;
  frameworkType: FrameworkType;
  objection:     string;
  specificity:   string;
}

export interface PhilosophicalCommitmentsResult {
  ethical:         FrameworkDetection<EthicalFramework>       | null;
  epistemic:       FrameworkDetection<EpistemicCommitment>    | null;
  political:       FrameworkDetection<PoliticalFramework>     | null;
  methodological:  FrameworkDetection<MethodologicalCommitment> | null;
  alternativePerspectives: AlternativePerspective[];
  notes: string | null;
}

export interface CommitmentsDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
