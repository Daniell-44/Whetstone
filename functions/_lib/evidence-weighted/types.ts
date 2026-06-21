// ---------------------------------------------------------------------------
// Claim-type classification (mirrors argument-extraction claimType)
// ---------------------------------------------------------------------------

export type ClaimType =
  | 'empirical_contested'
  | 'empirical_uncontested'
  | 'normative'
  | 'definitional'
  | 'modal_predictive';

// ---------------------------------------------------------------------------
// Semantic Scholar paper data (subset of what the API returns)
// ---------------------------------------------------------------------------

export interface SemanticScholarPaper {
  paperId:        string;
  title:          string;
  year:           number | null;
  citationCount:  number;
  influentialCitationCount: number;
  abstract:       string | null;
  url:            string;
  tldr:           { text: string } | null;
}

// ---------------------------------------------------------------------------
// Per-claim evidence assessment
// ---------------------------------------------------------------------------

export type ConsensusLevel =
  | 'strong_support'      // ≥80% of relevant literature supports
  | 'moderate_support'    // 55–79% supports
  | 'contested'           // roughly balanced or significant disagreement
  | 'moderate_opposition' // 55–79% of literature opposes
  | 'strong_opposition'   // ≥80% opposes
  | 'insufficient_data'   // too few relevant papers to assess
  | 'not_applicable';     // normative / definitional / not empirically testable

import type { GroundednessSignal } from '../grounded/types';

export interface EvidenceAssessment {
  claim:             string;
  claimType:         ClaimType;
  consensusLevel:    ConsensusLevel;
  // Share of assessed evidence supporting the claim (quality-weighted), 0–100 or
  // null. A descriptive fact about the literature — NEVER a probability of truth.
  literatureSupport: number | null;
  paperCount:        number;
  topPapers:         EvidencePaper[];
  explanation:       string;
  caveats:           string | null;
  groundedness:      GroundednessSignal;  // derived from paperCount + consensusLevel
}

export interface EvidencePaper {
  title:          string;
  year:           number | null;
  citationCount:  number;
  url:            string;
  stance:         'supports' | 'opposes' | 'mixed' | 'neutral';
  relevance:      string;  // one-sentence explanation of how this paper relates
}

// ---------------------------------------------------------------------------
// Full result for the endpoint
// ---------------------------------------------------------------------------

export interface EvidenceWeightedResult {
  assessments:    EvidenceAssessment[];
  notes:          string | null;
}

export interface EvidenceWeightedDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
