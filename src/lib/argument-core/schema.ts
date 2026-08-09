/**
 * argument-core — the shared contract between the site tool and the extension.
 *
 * P0 of the extension rebuild (Extension_Rebuild_Plan_v1.md §7): one schema,
 * three objects — skeleton (the structure pass), placement (where the piece
 * sits in the conversation), findings (the audit, with the fatal bar computed
 * in fatal.ts). Both surfaces render exactly this shape; neither forks it.
 *
 * The extension consumes this file across repos via a build-time alias
 * (Whetstone-Extension tsconfig/vite "@argument-core"), so keep it dependency-
 * free except zod, and keep the zod usage to the API subset that behaves the
 * same in zod 3 and 4.
 */
import { z } from 'zod';

/** Premise provenance, same grammar as the essay ::skeleton margin. */
export const PremiseTagSchema = z.enum(['stated', 'quoted', 'supplied']);

/** Signed 5-band ordinal on a named axis — the briefing stance grammar. */
export const StanceSchema = z.union([
  z.literal(-2),
  z.literal(-1),
  z.literal(0),
  z.literal(1),
  z.literal(2),
]);

export const PremiseSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  tag: PremiseTagSchema,
  /** A crux premise: the argument does not survive losing it. */
  crux: z.boolean().optional(),
});

export const InferenceLinkSchema = z.object({
  /** Premise ids this step rests on. */
  from: z.array(z.string().min(1)).min(1),
  /** The claim (or premise id) this step supports. */
  to: z.string().min(1),
  /** The inference rule, named in plain words. */
  rule: z.string().min(1),
  note: z.string().optional(),
});

export const WarrantSchema = z.object({
  /** An unstated assumption the argument needs. */
  text: z.string().min(1),
  /** Why the argument needs it. */
  necessity: z.string().optional(),
});

export const SkeletonSchema = z.object({
  /** The conclusion(s), reader-repeatable. */
  claims: z.array(z.string().min(1)).min(1),
  premises: z.array(PremiseSchema),
  links: z.array(InferenceLinkSchema),
  warrants: z.array(WarrantSchema),
});

/**
 * Where this piece sits in the conversation — the headline surface.
 * Absent (null on the map) when no tier resolved: the panel renders an honest
 * "no conversation map yet" state, never a guess.
 */
export const PlacementSchema = z.object({
  /** The contested question, one line. */
  question: z.string().min(1),
  /** Named axis poles — stance is meaningless without them. */
  axisLeft: z.string().min(1),
  axisRight: z.string().min(1),
  stance: StanceSchema,
  /** The frame it argues from, in plain words (optional — not every piece has a camp). */
  camp: z.string().optional(),
  /** What provoked it, when identifiable (a report, a policy, another column). */
  respondsTo: z.string().optional(),
  /** Placement honesty — interpretive calls must not wear false authority. */
  confidence: z.enum(['low', 'med', 'high']),
  /** The verbatim line the stance call rests on. Every placement shows its work. */
  basisQuote: z.string().min(1),
  /** Which tier resolved it: briefing match > conversation cache > live search. */
  tier: z.enum(['briefing', 'cache', 'live']),
  /** Set when tier === 'briefing'. */
  briefingSlug: z.string().optional(),
});

/** Steelman-first suggested reading. Inclusion is not agreement. */
export const SuggestionSchema = z.object({
  title: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url(),
  kind: z.enum(['opposing', 'adjacent', 'briefing']),
  /** Stance on the same axis; null when unplaced (e.g. the briefing itself). */
  stance: StanceSchema.nullable(),
  /** One line on why it earns the click. */
  whyWorthIt: z.string().min(1),
});

export const FindingSchema = z.object({
  /** The defect, named concretely. */
  name: z.string().min(1),
  /** Verbatim from the text — the cardinal-sin rule applies here too. */
  quote: z.string().min(1),
  explanation: z.string().min(1),
  severity: z.enum(['high', 'medium', 'low']),
  /** The site's groundedness vocabulary: Logic / Judgment call / Factual. */
  groundedness: z.enum(['structural', 'interpretive', 'empirical']),
  /** Where it sits in the argument — one of the fatal-bar conditions. */
  location: z.enum(['conclusion', 'crux-premise', 'aside', 'unknown']),
  /** Engine calibration (0..1), INTERNAL ONLY — never rendered (the
     no-numeric-scores law). Consumed by the fatal bar: when present it must
     clear the bar's confidence floor; when absent the categorical conditions
     stand alone. */
  confidence: z.number().min(0).max(1).optional(),
});

export const ArgumentMapSchema = z.object({
  meta: z.object({
    url: z.string().optional(),
    title: z.string().optional(),
    /** ISO date string, stamped by the caller (never inside this package). */
    accessedAt: z.string().optional(),
  }),
  skeleton: SkeletonSchema,
  placement: PlacementSchema.nullable(),
  suggestions: z.array(SuggestionSchema),
  findings: z.array(FindingSchema),
});

export type PremiseTag = z.infer<typeof PremiseTagSchema>;
export type Stance = z.infer<typeof StanceSchema>;
export type Premise = z.infer<typeof PremiseSchema>;
export type InferenceLink = z.infer<typeof InferenceLinkSchema>;
export type Warrant = z.infer<typeof WarrantSchema>;
export type Skeleton = z.infer<typeof SkeletonSchema>;
export type Placement = z.infer<typeof PlacementSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ArgumentMap = z.infer<typeof ArgumentMapSchema>;

/** Human labels for a stance on its axis — text always accompanies position (colourblind law). */
export function stanceLabel(stance: Stance, axisLeft: string, axisRight: string): string {
  switch (stance) {
    case -2: return `firmly toward "${axisLeft}"`;
    case -1: return `leaning toward "${axisLeft}"`;
    case 0: return 'holding the centre';
    case 1: return `leaning toward "${axisRight}"`;
    case 2: return `firmly toward "${axisRight}"`;
  }
}
