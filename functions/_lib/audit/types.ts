// ---------------------------------------------------------------------------
// Audit findings use grounded attribution. Every finding type below has:
//   - severity:     'high' | 'medium' | 'low'   (unchanged)
//   - groundedness: GroundednessSignal           (replaces self-reported confidence)
//   - _debugConfidence?: number                  (legacy model-self-reported number,
//                                                  preserved for calibration analysis,
//                                                  NEVER displayed to the user)
//
// Every audit finding is `structural` (text-derivable). The engine injects
// the signal at populate time, so prompts no longer need to emit confidence.
// ---------------------------------------------------------------------------

import type { GroundednessSignal } from '../grounded/types';

export interface UnstatedWarrant {
  warrant:          string;
  necessity:        string;
  severity:         'high' | 'medium' | 'low';
  groundedness:     GroundednessSignal;
  _debugConfidence?: number;
}

export interface ToulminAnalysis {
  claim:            string;
  grounds:          string;
  statedWarrant:    string | null;
  unstatedWarrants: UnstatedWarrant[];
  weakestLink:      string;
}

export interface NamedFallacy {
  name:             string;
  quote:            string;
  explanation:      string;
  severity:         'high' | 'medium' | 'low';
  groundedness:     GroundednessSignal;
  _debugConfidence?: number;
}

export interface LoadedLanguage {
  phrase:           string;
  technique:        string;
  explanation:      string;
  severity:         'high' | 'medium' | 'low';
  groundedness:     GroundednessSignal;
  _debugConfidence?: number;
}

// ---------------------------------------------------------------------------
// Phase-2 issue types
// ---------------------------------------------------------------------------

export type KeyTermIssue =
  | 'stipulative-smuggling'
  | 'cross-language-game-equivocation'
  | 'family-resemblance-overreach';

export type ReferentIssue =
  | 'empty-referent'
  | 'vague-proper-name'
  | 'failed-presupposition';

export type FalsifiabilityIssue =
  | 'no-truth-conditions'
  | 'circular-truth-conditions'
  | 'unfalsifiable-dressed-as-substantive';

export type ModalScopeIssue =
  | 'necessity-overstated'          // uses must/will/certain where evidence supports only may/might/could
  | 'possibility-treated-as-fact'   // a speculative could-happen scenario is treated as established in later claims
  | 'contingency-obscured'          // a conditional prediction is presented without its conditions, inflating apparent certainty
  | 'hedge-stripped-in-conclusion'; // premises contain explicit probability hedges that the conclusion silently drops

// ---------------------------------------------------------------------------
// Phase-2 finding interfaces
// ---------------------------------------------------------------------------

export interface KeyTermScrutinyFinding {
  term:             string;
  usage_a:          string;
  usage_b:          string;
  issue:            KeyTermIssue;
  explanation:      string;
  severity:         'high' | 'medium' | 'low';
  groundedness:     GroundednessSignal;
  _debugConfidence?: number;
}

export interface ReferentCheckFinding {
  phrase:           string;
  issue:            ReferentIssue;
  explanation:      string;
  evidence:         string;
  severity:         'high' | 'medium' | 'low';
  groundedness:     GroundednessSignal;
  _debugConfidence?: number;
}

export interface FalsifiabilityFinding {
  claim:            string;
  issue:            FalsifiabilityIssue;
  explanation:      string;
  evidence:         string;
  severity:         'high' | 'medium' | 'low';
  groundedness:     GroundednessSignal;
  _debugConfidence?: number;
}

export interface ModalScopeCheckFinding {
  claim:            string;
  inflatedModal:    string;
  impliedModal:     string;
  issue:            ModalScopeIssue;
  explanation:      string;
  evidence:         string;
  severity:         'high' | 'medium' | 'low';
  groundedness:     GroundednessSignal;
  _debugConfidence?: number;
}

// ---------------------------------------------------------------------------
// Core result
// ---------------------------------------------------------------------------

export interface AuditResult {
  centralClaim:         string;
  toulmin:              ToulminAnalysis;
  namedFallacies:       NamedFallacy[];
  loadedLanguage:       LoadedLanguage[];
  notes:                string | null;
  keyTermScrutiny:      KeyTermScrutinyFinding[];
  referentChecks:       ReferentCheckFinding[];
  falsifiabilityChecks: FalsifiabilityFinding[];
  modalScopeChecks:     ModalScopeCheckFinding[];
}

export interface AuditInput {
  text: string;
}

export interface AuditDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
  includePhase2?:   boolean;
  goals?:           import('./goals').DraftGoals;
  /** Prompt experiment flags. All default off = the current production prompt.
   *  Each is A/B'd via the detection eval before it ever becomes a default.
   *   - impartiality:    negative-prompting clause — judge the argument on its
   *     logic regardless of who wrote it, its eloquence, or whether you agree
   *     (sycophancy / verbosity-bias mitigation).
   *   - reasoningFirst:  emit a stripped `_reasoning` field before the scored
   *     fields. The engine already runs with a thinking budget, so possibly
   *     redundant — off by default for the eval to settle.
   *   - soundnessGate:   detect-then-classify (research Flow 2) — decide the
   *     reasoning is sound by default, only flag on a specific structural flaw.
   *     Precision-oriented; targets over-detection.
   *   - criticalQuestions: charitable reading + Walton critical-questions guard
   *     (research Flow 1) — before flagging, take the most charitable valid
   *     reading and check the scheme's critical questions; a legitimate move
   *     that answers them is not a fallacy. Precision-oriented. */
  promptVariant?:   {
    impartiality?:      boolean;
    reasoningFirst?:    boolean;
    soundnessGate?:     boolean;
    criticalQuestions?: boolean;
  };
}
