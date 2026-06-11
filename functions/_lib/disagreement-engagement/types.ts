// ---------------------------------------------------------------------------
// Disagreement-engagement quality.
//
// Measures whether the author engages with the STRONGEST version of opposing
// positions, or with strawmen, or whether they ignore opposing positions
// entirely. Distinct from the counterargument generator (which produces an
// opposing case from scratch) — this lens evaluates how well the author has
// already done that work.
//
// Why it matters: arguments that defeat weak versions of their opposition
// prove nothing about the strong version. A reader needs to know whether the
// piece is genuinely arguing or just performing argument.
// ---------------------------------------------------------------------------

export type EngagementQuality =
  | 'steelmanned'        // strongest version engaged with directly
  | 'representative'     // a common, fair version of the position engaged with
  | 'weak_version'       // a weak or unrepresentative version engaged with
  | 'strawman'           // a version no proponent would recognise
  | 'mentioned_only'     // named but not engaged with
  | 'absent';            // not addressed at all

import type { GroundednessSignal } from '../grounded/types';

export interface OpposingPositionEngagement {
  position:              string;
  authorTreatment:       string;
  triggerPassage:        string | null;
  quality:               EngagementQuality;
  whyThisQuality:        string;
  strongerVersion:       string | null;
  whatChangesIfEngaged:  string;
  groundedness:          GroundednessSignal;
  _debugConfidence?:     number;
}

export interface DisagreementEngagementResult {
  engagements:    OpposingPositionEngagement[];
  overallVerdict: 'rigorous' | 'partial' | 'weak' | 'absent';
  summary:        string;                  // 2-3 sentences characterising the author's engagement style
  notes:          string | null;
}

export interface DisagreementEngagementDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
