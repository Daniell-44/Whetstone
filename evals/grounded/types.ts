// ---------------------------------------------------------------------------
// Grounded attribution — eval harness types.
//
// Goal: measure whether the engine's assigned `groundedness.kind` agrees with
// human-labelled ground truth on a held-out fixture set. ≥85% agreement is
// the gate before declaring grounded attribution production-verified.
// ---------------------------------------------------------------------------

import type { GroundednessKind } from '../../functions/_lib/grounded/types';

export type EngineName =
  | 'audit'
  | 'extraction'
  | 'commitments'
  | 'citation';

/** One human-labelled fixture for a single engine. */
export interface Fixture {
  id:        string;            // stable identifier, used in reports
  engine:    EngineName;
  /** Source text the engine runs on. ~100-1000 chars. */
  text:      string;
  /** What the human believes the engine SHOULD produce. */
  expected:  ExpectedFinding[];
  /** Free-text reasoning for the labels — useful for re-evaluating later. */
  notes?:    string;
}

/** One expected finding, with the human-assigned kind. */
export interface ExpectedFinding {
  /** A short tag the human gives this finding. Used to identify it in
   *  per-finding agreement scoring. The runner doesn't try to match this
   *  against actual engine output — it's for the labeller's reference. */
  label:    string;
  /** The kind the human believes the engine SHOULD assign. */
  kind:     GroundednessKind;
  /** Free-text reason for the label. */
  reason?:  string;
}

/** Per-fixture agreement result after running the engine. */
export interface FixtureResult {
  fixtureId:           string;
  engine:              EngineName;
  expectedKindCounts:  Record<GroundednessKind, number>;
  actualKindCounts:    Record<GroundednessKind, number>;
  /** True if the kind distributions match within tolerance. */
  agreed:              boolean;
  /** Diagnostic string for mismatches. */
  diagnostic:          string;
}

/** Aggregate summary across all fixtures. */
export interface EvalSummary {
  totalFixtures:    number;
  agreedFixtures:   number;
  agreementPercent: number;
  byEngine:         Record<EngineName, { total: number; agreed: number }>;
  failingFixtures:  FixtureResult[];
}
