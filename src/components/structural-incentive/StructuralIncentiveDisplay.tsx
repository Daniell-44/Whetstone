import type { StructuralIncentiveResult, InterestAlignment } from '../../../functions/_lib/structural-incentive/types';
import GroundednessChip from '../grounded/GroundednessChip';

const KIND_LABEL: Record<string, string> = {
  economic_position:     'Economic position',
  institutional_role:    'Institutional role',
  political_constituency:'Political constituency',
  cultural_group:        'Cultural group',
  professional_class:    'Professional class',
  other:                 'Other',
};

function AlignmentCard({ a }: { a: InterestAlignment }) {
  return (
    <div class="rounded-lg border border-gray-200 bg-white p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-[10px] font-semibold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{KIND_LABEL[a.stakeholderKind] ?? a.stakeholderKind}</span>
        <span class="ml-auto"><GroundednessChip groundedness={a.groundedness} compact /></span>
      </div>
      <p class="text-sm text-gray-900 font-medium leading-snug mb-1.5">{a.whoseInterest}</p>
      <p class="text-xs text-gray-700 leading-relaxed mb-2">{a.howFramingServes}</p>
      <blockquote class="text-xs text-gray-500 border-l-2 border-gray-200 pl-2.5 italic mb-2 leading-relaxed">
        {a.triggerPassage}
      </blockquote>
      {a.counterStakeholder && (
        <p class="text-[11px] text-gray-500">
          <span class="font-semibold text-gray-600">Counter-stakeholder:</span> {a.counterStakeholder}
        </p>
      )}
    </div>
  );
}

export default function StructuralIncentiveDisplay({ result }: { result: StructuralIncentiveResult }) {
  return (
    <div class="space-y-4">
      <div class="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-1.5">Framing summary</p>
        <p class="text-sm text-gray-800 leading-relaxed">{result.framingSummary}</p>
      </div>

      {result.alignments.length === 0 ? (
        <p class="text-sm text-gray-500">No clear structural interest alignment identified for this piece.</p>
      ) : (
        <div class="space-y-3">
          {result.alignments.map((a, i) => <AlignmentCard key={i} a={a} />)}
        </div>
      )}

      {/* Caveat ALWAYS shown — non-optional UI element. The lens is dangerous without it. */}
      <div class="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">Important</p>
        <p class="text-xs text-gray-700 leading-relaxed">{result.importantCaveat}</p>
      </div>

      {result.notes && <p class="text-xs text-gray-400 italic">{result.notes}</p>}
    </div>
  );
}
