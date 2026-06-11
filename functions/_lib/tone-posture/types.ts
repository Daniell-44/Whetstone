// ---------------------------------------------------------------------------
// Rhetorical posture — HOW the argument addresses its audience
// ---------------------------------------------------------------------------

export type RhetoricalPosture =
  | 'authoritative'     // speaks from a position of expertise or institutional standing
  | 'adversarial'       // frames a conflict; the audience is asked to pick sides
  | 'conciliatory'      // seeks common ground; acknowledges complexity
  | 'pedagogical'       // explains or teaches; the audience is positioned as learner
  | 'confessional'      // draws authority from personal experience or vulnerability
  | 'ironic'            // says one thing to communicate another; relies on audience sophistication
  | 'prophetic'         // warns of consequences; moral urgency as the primary register
  | 'detached'          // presents without overt stance; academic or journalistic remove
  | 'mixed';            // no dominant posture; shifts between registers

// ---------------------------------------------------------------------------
// Tonal register — the emotional temperature of the prose
// ---------------------------------------------------------------------------

export type TonalRegister =
  | 'measured'          // calm, balanced, controlled cadence
  | 'urgent'            // accelerating cadence, compressed sentences, deadline framing
  | 'indignant'         // moral anger expressed through diction, not just content
  | 'sardonic'          // biting humour, contempt expressed through wit
  | 'earnest'           // sincere, unironic, emotionally direct
  | 'clinical'          // deliberately emotionless, technical, distanced
  | 'elegiac'           // mourning a loss or decline; backward-looking register
  | 'polemic';          // combative, one-sided by design, rallying register

// ---------------------------------------------------------------------------
// Per-finding: specific tonal moves detected in the text
// ---------------------------------------------------------------------------

import type { GroundednessSignal } from '../grounded/types';

export interface TonalMove {
  passage:          string;
  move:             string;
  effect:           string;
  severity:         'high' | 'medium' | 'low';
  groundedness:     GroundednessSignal;
  _debugConfidence?:number;
}

// ---------------------------------------------------------------------------
// Full result
// ---------------------------------------------------------------------------

export interface TonePostureResult {
  posture:          RhetoricalPosture;
  postureEvidence:  string;           // specific evidence from the draft supporting the posture classification
  postureExplanation: string;         // why this posture matters for how the argument works
  register:         TonalRegister;
  registerEvidence: string;
  registerExplanation: string;
  tonalMoves:       TonalMove[];
  audiencePosition: string;
  notes:            string | null;
  groundedness:     GroundednessSignal;
  _debugConfidence?:number;
}

export interface TonePostureDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
