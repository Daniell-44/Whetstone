// ---------------------------------------------------------------------------
// Structural-incentive analysis ("cui bono").
//
// What it does: identifies whose POSITIONS in a debate or political economy
// benefit if a reader accepts this argument's framing. Distinct from
// ad-hominem (about the speaker). Structural-incentive analysis is about
// positions, not people — "this framing benefits employers in low-wage
// industries, regardless of who's making it."
//
// Why it's risky and DEFAULT-OFF:
//   - Thin line between structural critique and "argument from motive"
//   - Easy to weaponise — a reader who dislikes a position can use this lens
//     to dismiss the argument rather than engage with it.
//   - Output must explicitly note that an interest-aligned argument can still
//     be CORRECT. The lens surfaces a question to ask, not a verdict to apply.
//
// The prompt is structured to resist these failure modes.
// ---------------------------------------------------------------------------

export type StakeholderKind =
  | 'economic_position'     // those occupying a position in markets (employers in X industry, owners of Y asset)
  | 'institutional_role'    // holders of institutional power (regulators, professional associations)
  | 'political_constituency'// voters / movements aligned with the framing
  | 'cultural_group'        // identity-based groupings whose status the framing tracks
  | 'professional_class'    // occupations whose authority the framing reinforces
  | 'other';

import type { GroundednessSignal } from '../grounded/types';

export interface InterestAlignment {
  stakeholderKind:     StakeholderKind;
  whoseInterest:       string;
  howFramingServes:    string;
  triggerPassage:      string;
  counterStakeholder:  string | null;
  groundedness:        GroundednessSignal;
  _debugConfidence?:   number;
}

export interface StructuralIncentiveResult {
  alignments:        InterestAlignment[];
  framingSummary:    string;            // 2-3 sentences sketching the overall interest-alignment of the framing
  importantCaveat:   string;            // 1-2 sentences reminding the reader that interest-aligned arguments can still be correct
  notes:             string | null;
}

export interface StructuralIncentiveDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
