import type { EpistemicHumilityResult, HumilityFinding } from '../../../functions/_lib/epistemic-humility/types';
import GroundednessChip from '../grounded/GroundednessChip';

const CERTAINTY_LABEL: Record<string, string> = {
  flat_assertion:       'Flat assertion',
  strong_modal:         'Strong modal',
  moderate_modal:       'Moderate modal',
  hedge:                'Hedge',
  explicit_uncertainty: 'Explicit uncertainty',
};

const EVIDENCE_LABEL: Record<string, string> = {
  well_established: 'Well-established',
  contested:        'Contested',
  limited:          'Limited evidence',
  speculative:      'Speculative',
  not_applicable:   'Not empirical',
};

const SEV_CLS: Record<string, string> = {
  high:   'border-red-200    bg-red-50',
  medium: 'border-amber-200  bg-amber-50',
  low:    'border-gray-200   bg-white',
};

const VERDICT_BADGE: Record<string, { label: string; cls: string }> = {
  well_calibrated:             { label: 'Well-calibrated',              cls: 'bg-emerald-100 text-emerald-700' },
  mildly_overconfident:        { label: 'Mildly overconfident',         cls: 'bg-amber-100 text-amber-700' },
  systematically_overconfident:{ label: 'Systematically overconfident', cls: 'bg-red-100 text-red-700' },
  underconfident:              { label: 'Underconfident',               cls: 'bg-sky-100 text-sky-700' },
  mixed:                       { label: 'Mixed',                        cls: 'bg-gray-100 text-gray-700' },
};

function FindingCard({ f }: { f: HumilityFinding }) {
  return (
    <div class={`rounded-lg border p-4 ${SEV_CLS[f.severity]}`}>
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class="text-[10px] font-medium px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
          {CERTAINTY_LABEL[f.certainty]} → {EVIDENCE_LABEL[f.evidenceState]}
        </span>
        <span class="ml-auto"><GroundednessChip groundedness={f.groundedness} compact /></span>
      </div>
      <blockquote class="text-xs text-gray-600 border-l-2 border-gray-300 pl-2.5 italic mb-2 leading-relaxed">
        {f.passage}
      </blockquote>
      <p class="text-xs text-gray-700 leading-relaxed mb-2">{f.gap}</p>
      <div class="rounded bg-white border border-gray-200 px-3 py-2">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1">Suggested framing</p>
        <p class="text-xs text-gray-800 leading-relaxed">"{f.suggestedFraming}"</p>
      </div>
    </div>
  );
}

export default function EpistemicHumilityDisplay({ result }: { result: EpistemicHumilityResult }) {
  const badge = VERDICT_BADGE[result.overallVerdict] ?? VERDICT_BADGE.mixed;
  return (
    <div class="space-y-4">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <div class="flex items-center gap-2 mb-2">
          <span class={`text-[10px] font-medium px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
        </div>
        <p class="text-sm text-gray-800 leading-relaxed">{result.summary}</p>
      </div>

      {result.findings.length === 0 ? (
        <p class="text-sm text-gray-400">No calibration issues flagged.</p>
      ) : (
        <div class="space-y-3">
          {result.findings.map((f, i) => <FindingCard key={i} f={f} />)}
        </div>
      )}

      {result.notes && <p class="text-xs text-gray-400 italic">{result.notes}</p>}
    </div>
  );
}
