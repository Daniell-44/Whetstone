import type { GroundednessSignal } from '../../../functions/_lib/grounded/types';
import {
  GROUNDEDNESS_LABEL,
  GROUNDEDNESS_DESCRIPTION,
  INTERPRETIVE_BAND_LABEL,
} from '../../../functions/_lib/grounded/types';

// ---------------------------------------------------------------------------
// GroundednessChip - always-on visual indicator of finding type.
//
// Colours:
//   structural   → blue       (verifiable in text)
//   interpretive → grey       (depends on reading)
//   empirical    → emerald    (backed by external sources)
//
// Hover tooltip explains what the kind means.
// ---------------------------------------------------------------------------

const KIND_STYLE = {
  structural:   'bg-sky-100      text-sky-800      border-sky-200',
  interpretive: 'bg-gray-100     text-gray-700     border-gray-200',
  empirical:    'bg-emerald-100  text-emerald-800  border-emerald-200',
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
      class={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${cls}`}
      title={desc}
    >
      {compact ? GROUNDEDNESS_LABEL[groundedness.kind] : signalText(groundedness)}
    </span>
  );
}
