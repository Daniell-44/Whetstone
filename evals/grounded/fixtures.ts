// ---------------------------------------------------------------------------
// Seed fixtures for grounded attribution eval.
//
// Target: 50 fixtures total, ~12-13 per engine. This file ships with a
// representative seed (8 fixtures) — extend by adding entries below as you
// label more text yourself or recruit a beta tester to label.
//
// Each fixture's `expected.kind` is what YOU (Daniel) believe the engine
// SHOULD assign. The runner compares the engine's actual output against
// this and reports agreement.
//
// Labelling guide:
//   - structural   : the finding is verifiable in the quoted text alone
//   - interpretive : the finding depends on a reading of intent/framing
//   - empirical    : the finding makes a claim about the world that needs
//                    external corroboration (citation, paper, etc.)
// ---------------------------------------------------------------------------

import type { Fixture } from './types';

export const FIXTURES: Fixture[] = [

  // ===== AUDIT engine ======================================================
  // All audit findings are STRUCTURAL by design.
  // ========================================================================

  {
    id:     'audit-01-strawman',
    engine: 'audit',
    text:   `My opponents believe that we should have absolutely no border controls of any kind. This is absurd and dangerous. We must reject their position and maintain strong borders.`,
    expected: [
      { label: 'named fallacy — strawman',     kind: 'structural', reason: 'Strawman of opposing view is verifiable in the quoted text.' },
      { label: 'loaded language — "absurd"',   kind: 'structural', reason: 'Loaded phrase quoted verbatim.' },
    ],
    notes: 'Classic strawman + emotional loading. Both audit findings should be structural.',
  },

  {
    id:     'audit-02-modal-inflation',
    engine: 'audit',
    text:   `A recent study suggests that some children may benefit from later school start times. Therefore, all schools must mandate 10am start times immediately to ensure all our children succeed.`,
    expected: [
      { label: 'modal scope — necessity overstated', kind: 'structural', reason: '"suggests" / "some" / "may" → "must" / "all" is verifiable text-shift.' },
      { label: 'unstated warrant',                    kind: 'structural', reason: 'Warrant connecting the study to a national policy is missing in the text.' },
    ],
  },

  // ===== EXTRACTION engine =================================================
  // Argument extraction is INTERPRETIVE — the central claim and statement
  // structure depend on a reading of the text.
  // ========================================================================

  {
    id:     'extraction-01-clear-argument',
    engine: 'extraction',
    text:   `The minimum wage should be raised because workers earning poverty wages cannot afford basic necessities, and increased purchasing power stimulates the economy. Some economists worry about job losses, but recent empirical work suggests the effect is small.`,
    expected: [
      { label: 'central claim',  kind: 'interpretive', reason: 'Identifying THE central claim of an argument is a reading choice.' },
      { label: 'premise mapping', kind: 'interpretive', reason: 'Which statements are premises vs which support which is interpretive.' },
    ],
  },

  {
    id:     'extraction-02-mixed-types',
    engine: 'extraction',
    text:   `Free will is incompatible with determinism. Since neuroscience has established that all behaviour follows from prior physical states, we should reject the legal doctrine of moral responsibility.`,
    expected: [
      { label: 'central claim',         kind: 'interpretive' },
      { label: 'philosophical premise', kind: 'interpretive', reason: 'Free will / determinism framing is interpretive.' },
    ],
    notes: 'Mixed empirical + normative premises. Engine should classify these correctly.',
  },

  // ===== COMMITMENTS engine ================================================
  // All commitments findings are INTERPRETIVE — philosophical reading of
  // the text's underlying framework.
  // ========================================================================

  {
    id:     'commitments-01-consequentialist',
    engine: 'commitments',
    text:   `Whether a policy is right depends entirely on its outcomes. If raising taxes on the wealthy reduces inequality and improves welfare for the worst-off, then we should do it — regardless of any abstract claim about property rights.`,
    expected: [
      { label: 'ethical: consequentialist', kind: 'interpretive', reason: 'Identifying ethical framework is a reading of the text.' },
    ],
  },

  {
    id:     'commitments-02-empiricist',
    engine: 'commitments',
    text:   `We need to follow the data. Whatever we feel about climate policy is irrelevant — the question is what the empirical record shows about emissions, temperature change, and economic disruption. Anything else is just opinion.`,
    expected: [
      { label: 'epistemic: empiricist', kind: 'interpretive' },
    ],
  },

  // ===== CITATION-AUDIT engine =============================================
  // All citation-audit findings are EMPIRICAL — claim about whether the
  // citation supports the claim it's used for.
  // ========================================================================

  {
    id:     'citation-01-well-cited',
    engine: 'citation',
    text:   `A 2019 meta-analysis published in The Lancet found that the global average life expectancy increased by 5.5 years between 2000 and 2019 [source: https://doi.org/10.1016/example].`,
    expected: [
      { label: 'well-cited claim', kind: 'empirical', reason: 'The truth of the claim depends on what the source actually says.' },
    ],
  },

  {
    id:     'citation-02-mismatched',
    engine: 'citation',
    text:   `Studies show that violent video games cause real-world violence in children. [source: https://example.com/some-study]. We must act to restrict access immediately.`,
    expected: [
      { label: 'mismatched citation', kind: 'empirical', reason: 'Either the source actually supports the claim or it doesn\'t.' },
    ],
    notes: 'Engine should mark as empirical regardless of whether verdict is well-cited or mismatched.',
  },
];
