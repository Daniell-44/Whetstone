// ---------------------------------------------------------------------------
// Kind-assignment registry.
//
// Each engine's findings get a default kind. Most engines have a single kind
// for all their outputs; a few are mixed.
//
// To keep this honest, every prompt update that introduces a NEW finding type
// MUST also add an entry here. Tests should fail if a finding type lacks an
// assignment.
// ---------------------------------------------------------------------------

import type { GroundednessKind } from './types';

/**
 * Default kind per engine + finding type.
 *
 * Key format: `<engine>:<finding_type>` or just `<engine>` if all findings
 * from that engine share a kind.
 *
 * `'context'` means the runtime decides at populate time (e.g. extraction
 * statements pick kind by their `claimType`).
 */
export const KIND_ASSIGNMENTS: Record<string, GroundednessKind | 'context'> = {
  // Audit engine — all structural (verifiable in quoted text)
  'audit:fallacy':              'structural',
  'audit:loaded_language':      'structural',
  'audit:unstated_warrant':     'structural',
  'audit:key_term':             'structural',
  'audit:referent':             'structural',
  'audit:falsifiability':       'structural',
  'audit:modal_scope':          'structural',

  // Extraction — central claim is interpretive; statements depend on claimType
  'extraction:central_claim':   'interpretive',
  'extraction:statement':       'context',

  // Commitments — interpretive (philosophical reading of the text)
  'commitments':                'interpretive',

  // Citation audit — empirical (the citation either exists/says what claimed or doesn't)
  'citation_audit':             'empirical',

  // Counterargument — interpretive (alternative reading)
  'counterargument':            'interpretive',

  // Evidence-weighted — empirical by definition
  'evidence_weighted':          'empirical',

  // Tone-posture — interpretive (about the writer's choices)
  'tone_posture':               'interpretive',

  // Presupposition — interpretive
  'presupposition':             'interpretive',

  // Rhetorical-mode — interpretive
  'rhetorical_mode':            'interpretive',

  // Epistemic-humility — structural (text-derivable certainty markers vs evidence)
  'epistemic_humility':         'structural',

  // Disagreement-engagement — interpretive (judgement about how the author engaged)
  'disagreement_engagement':    'interpretive',

  // Structural-incentive — interpretive (judgement about whose positions are served)
  'structural_incentive':       'interpretive',
};

export function getDefaultKind(key: string): GroundednessKind | 'context' | null {
  return KIND_ASSIGNMENTS[key] ?? null;
}
