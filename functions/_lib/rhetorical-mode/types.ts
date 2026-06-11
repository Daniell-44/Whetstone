// ---------------------------------------------------------------------------
// Rhetorical-mode analysis — Aristotle's ethos/pathos/logos triangle.
//
// What kind of appeal dominates a piece of argumentation? A pure-logos piece
// invites scrutiny on its premises; a pure-pathos piece invites scrutiny on
// what feelings it's mobilising; a pure-ethos piece invites scrutiny on the
// authorities it borrows from.
//
// Distinct from tone/posture (which is HOW the writer addresses the reader).
// Rhetorical mode is WHAT KIND OF APPEAL the writer is making.
// ---------------------------------------------------------------------------

export interface RhetoricalBalance {
  ethosPercent:  number;   // appeal to character / authority / credibility
  pathosPercent: number;   // appeal to emotion / values / felt response
  logosPercent:  number;   // appeal to logic / evidence / structured reasoning
}

export type AppealKind = 'ethos' | 'pathos' | 'logos';

export interface RhetoricalMove {
  kind:        AppealKind;
  passage:     string;     // verbatim substring from input
  description: string;     // 1 sentence: what the move does and how
}

import type { GroundednessSignal } from '../grounded/types';

export interface RhetoricalModeResult {
  balance:           RhetoricalBalance;
  dominantAppeal:    AppealKind | 'mixed';
  moves:             RhetoricalMove[];
  readerCaveat:      string;
  notes:             string | null;
  groundedness:      GroundednessSignal;
  _debugConfidence?: number;
}

export interface RhetoricalModeDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
