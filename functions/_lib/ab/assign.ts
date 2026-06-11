// ---------------------------------------------------------------------------
// Deterministic variant assignment.
//
// Hash(experiment_key + subject_id) → uniform 0..1 → bucket by cumulative
// variant weight. Same subject always gets the same variant for the same
// experiment, no DB write needed.
//
// subject_id rules (caller picks):
//   - signed-in user → user.id (stable across devices)
//   - anonymous      → sessionHash (stable for the browser session)
// ---------------------------------------------------------------------------

import type { ExperimentDefinition } from './experiments';

/** FNV-1a 32-bit — fast, deterministic, no crypto needed for bucketing. */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Return value in [0, 1). */
function bucket(experimentKey: string, subjectId: string): number {
  return fnv1a(`${experimentKey}|${subjectId}`) / 0x100000000;
}

export function assignVariant(
  experiment: ExperimentDefinition,
  subjectId:  string,
): string {
  if (experiment.status === 'ended' && experiment.winner) return experiment.winner;

  const totalWeight = experiment.variants.reduce((s, v) => s + v.weight, 0);
  if (totalWeight <= 0) return experiment.variants[0]?.key ?? 'control';

  const roll = bucket(experiment.key, subjectId) * totalWeight;
  let acc = 0;
  for (const v of experiment.variants) {
    acc += v.weight;
    if (roll < acc) return v.key;
  }
  return experiment.variants[experiment.variants.length - 1].key;
}
