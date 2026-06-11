// ---------------------------------------------------------------------------
// A/B experiments registry — code-defined, not DB-managed.
//
// Why code-defined: experiments touch UI copy, layout, or flow. Editing them
// in a DB without a code change is a footgun — the variant code has to exist.
// We get the same shipping speed by colocating definition with implementation.
//
// Add a new experiment: append an entry below, then read its variant in the
// page/component via `useVariant('experiment_key')`.
//
// Retire an experiment: set `status: 'ended'` and record the winner. The
// hook will always return the winner for ended experiments, regardless of
// what the user was previously assigned. Leave the entry in place for at
// least 30 days so analytics queries can still resolve historical exposures.
// ---------------------------------------------------------------------------

export interface ExperimentVariant {
  key:    string;          // short identifier, used in analytics + URLs
  weight: number;          // relative weight; variants normalised to sum=1
}

export interface ExperimentDefinition {
  key:         string;     // snake_case unique identifier
  description: string;     // what the test is for; shown in admin dashboard
  status:      'active' | 'ended';
  variants:    ExperimentVariant[];
  /** When status='ended', force everyone onto this variant key. */
  winner?:     string;
  /** When the experiment started — used for analytics window. */
  startedAt:   string;     // ISO date
}

export const EXPERIMENTS: ExperimentDefinition[] = [
  // -------------------------------------------------------------------------
  // reader_hero_copy
  //
  // Hypothesis: the introspective hero ("Think more carefully") tells users
  // how to feel; the concrete hero ("See where an argument's reasoning
  // breaks down") tells them what the tool does. The latter should lift
  // audit_completed within session.
  //
  // Success metric: rate of `audit_completed` per `experiment_exposure`
  // session, sliced by variant. Read after >= 200 exposed sessions per arm.
  // -------------------------------------------------------------------------
  {
    key:         'reader_hero_copy',
    description: 'Reader landing hero: introspective vs concrete framing',
    status:      'active',
    variants:    [
      { key: 'control',  weight: 1 }, // "Think more carefully about arguments."
      { key: 'concrete', weight: 1 }, // "See where an argument's reasoning breaks down."
    ],
    startedAt:   '2026-06-08',
  },
];

export type ExperimentKey = (typeof EXPERIMENTS)[number]['key'];

export function findExperiment(key: string): ExperimentDefinition | null {
  return EXPERIMENTS.find((e) => e.key === key) ?? null;
}
