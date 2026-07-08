import type { GroundednessSignal } from '../../../functions/_lib/grounded/types';
import {
  GROUNDEDNESS_LABEL,
  GROUNDEDNESS_DESCRIPTION,
  INTERPRETIVE_BAND_LABEL,
} from '../../../functions/_lib/grounded/types';

// ---------------------------------------------------------------------------
// GroundednessChip - always-on visual indicator of finding type.
//
// Colours (Instrument tokens — squared, mono):
//   structural   → Logic    (verifiable in text)
//   interpretive → Judgment (depends on reading)
//   empirical    → Factual  (backed by external sources)
//
// Hover tooltip explains what the kind means.
// ---------------------------------------------------------------------------

const KIND_STYLE = {
  structural:   'bg-logic-bg     text-logic     border-logic/30',
  interpretive: 'bg-judgment-bg  text-judgment  border-judgment/30',
  empirical:    'bg-factual-bg   text-factual   border-factual/30',
} as const;

function signalText(g: GroundednessSignal): string {
  switch (g.kind) {
    case 'structural':
      return GROUNDEDNESS_LABEL.structural;
    case 'interpretive':
      return `${GROUNDEDNESS_LABEL.interpretive} · ${INTERPRETIVE_BAND_LABEL[g.band]}`;
    case 'empirical': {
      const consensus =
        g.consensus === 'strong_support'      ? 'strong support'      :
        g.consensus === 'moderate_support'    ? 'moderate support'    :
        g.consensus === 'contested'           ? 'contested'           :
        g.consensus === 'moderate_opposition' ? 'moderate opposition' :
        g.consensus === 'strong_opposition'   ? 'strong opposition'   :
        g.consensus === 'insufficient_data'   ? 'limited data'        :
                                                'not assessed';
      return `${GROUNDEDNESS_LABEL.empirical} · ${g.supportingCount}/${g.opposingCount} support·oppose · ${consensus}`;
    }
  }
}

export default function GroundednessChip({
  groundedness,
  compact = false,
}: {
  groundedness: GroundednessSignal;
  compact?:     boolean;
}) {
  const cls = KIND_STYLE[groundedness.kind];
  const desc = GROUNDEDNESS_DESCRIPTION[groundedness.kind];
  return (
    <span
      class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border text-xs font-mono font-medium ${cls}`}
      title={desc}
    >
      {compact ? GROUNDEDNESS_LABEL[groundedness.kind] : signalText(groundedness)}
    </span>
  );
}
