// ---------------------------------------------------------------------------
// Grounded attribution.
//
// Replaces per-finding `confidence: number` (self-reported by the model and
// poorly correlated with correctness) with a categorical `groundedness`
// signal that tells the user WHAT KIND OF JUDGEMENT they're looking at and
// the most honest signal we can attach to it given that kind.
//
// Three kinds:
//   - structural   : derivable from the quoted text using the engine's
//                    framework. The user verifies by reading the quote.
//                    No numeric confidence.
//   - interpretive : depends on a reading of intent or framing.
//                    Low-resolution band: high / medium / low.
//   - empirical    : claim about the world beyond the text.
//                    External grounding count via evidence-weighted module.
//
// See Research_Grounded_Attribution_v1.md for the design rationale.
// ---------------------------------------------------------------------------

import type { ConsensusLevel } from '../evidence-weighted/types';

export type GroundednessKind = 'structural' | 'interpretive' | 'empirical';

export type InterpretiveBand = 'high' | 'medium' | 'low';

export type GroundednessSignal =
  | { kind: 'structural' }
  | { kind: 'interpretive'; band: InterpretiveBand }
  | {
      kind:            'empirical';
      supportingCount: number;
      opposingCount:   number;
      consensus:       ConsensusLevel | null;
    };

// ---------------------------------------------------------------------------
// Kind weights for priority_score = severityWeight × kindWeight.
// Honest ordering: structural and well-supported empirical findings outrank
// interpretive readings at the same severity, because they're the easiest
// for the user to verify and the most likely to be correct.
// ---------------------------------------------------------------------------

export function kindWeight(g: GroundednessSignal): number {
  switch (g.kind) {
    case 'structural':
      return 1.0;
    case 'interpretive':
      return g.band === 'high' ? 0.8 : g.band === 'medium' ? 0.6 : 0.4;
    case 'empirical': {
      if (g.consensus === 'strong_support'   || g.consensus === 'strong_opposition')   return 1.0;
      if (g.consensus === 'moderate_support' || g.consensus === 'moderate_opposition') return 0.85;
      if (g.consensus === 'contested')                                                 return 0.7;
      if (g.consensus === 'insufficient_data')                                         return 0.4;
      return 0.5;
    }
  }
}

// ---------------------------------------------------------------------------
// Display labels (also used as tooltip text).
// ---------------------------------------------------------------------------

export const GROUNDEDNESS_LABEL: Record<GroundednessKind, string> = {
  structural:   'Structural',
  interpretive: 'Interpretive',
  empirical:    'Empirical',
};

export const GROUNDEDNESS_DESCRIPTION: Record<GroundednessKind, string> = {
  structural:   'Derivable from the quoted text. Check the quote against the finding.',
  interpretive: 'Depends on a reading of intent or framing. Judge for yourself.',
  empirical:    'Claim about the world. Backed by counted external sources.',
};

export const INTERPRETIVE_BAND_LABEL: Record<InterpretiveBand, string> = {
  high:   'high confidence',
  medium: 'medium confidence',
  low:    'low confidence',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convenience constructor — most engines call this and inject it on findings. */
export function structural(): GroundednessSignal {
  return { kind: 'structural' };
}

export function interpretive(band: InterpretiveBand): GroundednessSignal {
  return { kind: 'interpretive', band };
}

export function empirical(
  supportingCount: number,
  opposingCount:   number,
  consensus:       ConsensusLevel | null,
): GroundednessSignal {
  return { kind: 'empirical', supportingCount, opposingCount, consensus };
}

/**
 * Bridge function: derive an interpretive band from a numeric confidence
 * during migration. Used so engines that already emit numeric confidence
 * (legacy state) can produce an honest groundedness without re-prompting.
 * Tunable — these thresholds will be revisited after eval-harness work.
 *
 * DEPRECATED by path-1: prefer bandFromContestability, where the model rates
 * how contestable the reading is directly (an answerable question) rather than
 * self-reporting a confidence number (noise). Retained only as a fallback for
 * engines/responses that don't yet emit `contestability`.
 */
export function bandFromLegacyConfidence(c: number): InterpretiveBand {
  if (c >= 80) return 'high';
  if (c >= 55) return 'medium';
  return 'low';
}

/**
 * How contestable an interpretive reading is — i.e. how much careful, informed
 * readers would disagree about whether the finding is a fair reading of the
 * text. This is a question a model CAN answer (it's about the space of
 * reasonable readings), unlike self-reported "confidence".
 *
 *   low    = most careful readers would accept this reading  -> strong footing
 *   medium = reasonable readers could go either way
 *   high   = very much a judgement call; easy to read otherwise
 *
 * Mapped (inverted) onto the interpretive band: less contestable = higher band.
 */
export type ReadingContestability = 'low' | 'medium' | 'high';

export function bandFromContestability(c: ReadingContestability): InterpretiveBand {
  return c === 'low' ? 'high' : c === 'medium' ? 'medium' : 'low';
}
