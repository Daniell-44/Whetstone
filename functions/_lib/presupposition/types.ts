// ---------------------------------------------------------------------------
// Presupposition extraction.
//
// A presupposition is what the argument *takes as background* — accepted
// without argument. Distinct from an unstated warrant (which is an
// inferential premise the author would defend if pressed). Presuppositions
// are what the author would say "everyone knows" about — the bedrock the
// author refuses to put up for debate within this piece.
//
// Why this matters:
//   - Strong arguments often defend their warrants but quietly assume their
//     presuppositions. Surfacing them exposes where the argument's real
//     contestation lies.
//   - Audience-specific: different audiences accept different presuppositions.
//     Naming them helps a reader recognise when an argument was not written
//     for them.
// ---------------------------------------------------------------------------

export type PresuppositionDomain =
  | 'ontological'   // assumes the existence/nature of an entity ("the market")
  | 'normative'     // assumes a value or moral framework ("freedom is good")
  | 'epistemic'     // assumes a method of knowing ("studies show X is reliable")
  | 'causal'        // assumes a causal mechanism ("X causes Y")
  | 'categorical'   // assumes a category boundary ("a 'real' artist")
  | 'temporal'      // assumes a historical narrative ("we used to be...")
  | 'agent'         // assumes who counts as an actor ("we", "the country")
  | 'other';

export type PresuppositionContestability =
  | 'widely_shared'    // most readers in the implied audience would accept
  | 'community_shared' // accepted in a specific community but contested elsewhere
  | 'contested'        // actively debated
  | 'minority';        // a position most readers would not share

import type { GroundednessSignal } from '../grounded/types';

export interface Presupposition {
  domain:           PresuppositionDomain;
  statement:        string;
  triggerPassage:   string;
  contestability:   PresuppositionContestability;
  whyItMatters:     string;
  alternatives:     string[];
  groundedness:     GroundednessSignal;
  _debugConfidence?: number;
}

export interface PresuppositionResult {
  presuppositions: Presupposition[];
  audienceProfile: string;           // 2-3 sentences sketching the implied audience whose presuppositions the piece is built on
  notes:           string | null;
}

export interface PresuppositionDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
