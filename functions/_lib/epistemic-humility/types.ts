// ---------------------------------------------------------------------------
// Epistemic humility check.
//
// Flags places where the author claims more certainty than the strength of
// their evidence (or the state of the field) warrants. Distinct from the
// audit's "unstated warrant" or "falsifiability" findings: this is about
// CERTAINTY LANGUAGE specifically.
//
// Why it matters: confident prose carries authority. When the prose is more
// confident than the evidence, readers are misled — not by what's said, but
// by how it's said.
// ---------------------------------------------------------------------------

export type CertaintyLevel =
  | 'flat_assertion'       // stated as plain fact ("X is true")
  | 'strong_modal'         // "clearly", "obviously", "undeniably", "must"
  | 'moderate_modal'       // "likely", "probably", "tends to"
  | 'hedge'                // "may", "could", "seems", "appears"
  | 'explicit_uncertainty';// "we don't know", "it's contested"

export type EvidenceState =
  | 'well_established'     // strong consensus or robust empirical record
  | 'contested'            // actively debated
  | 'limited'              // little evidence either way
  | 'speculative'          // no real evidence, framework or extrapolation only
  | 'not_applicable';      // normative or definitional claim — evidence not the right test

import type { GroundednessSignal } from '../grounded/types';

export interface HumilityFinding {
  passage:           string;
  claim:             string;
  certainty:         CertaintyLevel;
  evidenceState:     EvidenceState;
  gap:               string;
  suggestedFraming:  string;
  severity:          'high' | 'medium' | 'low';
  groundedness:      GroundednessSignal;
  _debugConfidence?: number;
}

export interface EpistemicHumilityResult {
  findings:        HumilityFinding[];
  overallVerdict:  'well_calibrated' | 'mildly_overconfident' | 'systematically_overconfident' | 'underconfident' | 'mixed';
  summary:         string;           // 2-3 sentences characterising the author's epistemic register
  notes:           string | null;
}

export interface EpistemicHumilityDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
