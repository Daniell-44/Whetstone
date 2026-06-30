export type CitationVerdict =
  | 'well_cited'      // source clearly supports the claim
  | 'weakly_cited'    // source is related but doesn't fully back the claim
  | 'mismatched'      // source contradicts or doesn't say what the draft claims
  | 'uncited'         // factual claim with no associated citation
  | 'academic_reference' // cites an "(Author, Year)"-style reference with no linkable URL — not auto-checkable
  | 'unfetchable'     // citation URL exists but couldn't be retrieved
  | 'non_factual';    // not actually a factual claim (analyst feedback only, not user-shown by default)

import type { GroundednessSignal } from '../grounded/types';

export interface CitedClaim {
  claim:               string;
  evidenceQuote:       string;
  citationUrl:         string | null;
  citationContext?:    string;
  verdict:             CitationVerdict;
  verdictExplanation:  string;
  sourceExcerpt:       string | null;
  sourceTitle:         string | null;
  sourcePublication:   string | null;
  groundedness:        GroundednessSignal;
  _debugConfidence?:   number;
}

export interface CitationAuditResult {
  factualClaims: CitedClaim[];
  notes:         string | null;
  summary: {
    total:        number;
    wellCited:    number;
    weaklyCited:  number;
    mismatched:        number;
    uncited:           number;
    academicReference: number;
    unfetchable:       number;
  };
}
