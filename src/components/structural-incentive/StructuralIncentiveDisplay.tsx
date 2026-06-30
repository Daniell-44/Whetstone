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
    <div class="rounded-lg border border-hairline bg-surface p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-semibold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{KIND_LABEL[a.stakeholderKind] ?? a.stakeholderKind}</span>
        <span class="ml-auto"><GroundednessChip groundedness={a.groundedness} compact /></span>
      </div>
      <p class="text-sm text-ink-strong font-medium leading-snug mb-1.5">{a.whoseInterest}</p>
      <p class="text-xs text-ink leading-relaxed mb-2">{a.howFramingServes}</p>
      <blockquote class="text-xs text-muted border-l-2 border-hairline pl-2.5 italic mb-2 leading-relaxed">
        {a.triggerPassage}
      </blockquote>
      {a.counterStakeholder && (
        <p class="text-xs text-muted">
          <span class="font-semibold text-ink">Counter-stakeholder:</span> {a.counterStakeholder}
        </p>
      )}
    </div>
  );
}

export default function StructuralIncentiveDisplay({ result }: { result: StructuralIncentiveResult }) {
  return (
    <div class="space-y-4">
      <div class="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-1.5">Framing summary</p>
        <p class="text-sm text-ink leading-relaxed">{result.framingSummary}</p>
      </div>

      {result.alignments.length === 0 ? (
        <p class="text-sm text-muted">No clear structural interest alignment identified for this piece.</p>
      ) : (
        <div class="space-y-3">
          {result.alignments.map((a, i) => <AlignmentCard key={i} a={a} />)}
        </div>
      )}

      {/* Caveat ALWAYS shown - non-optional UI element. The lens is dangerous without it. */}
      <div class="rounded-lg border border-hairline bg-paper px-4 py-3">
        <p class="text-xs font-semibold uppercase tracking-widest text-ink mb-1">Important</p>
        <p class="text-xs text-ink leading-relaxed">{result.importantCaveat}</p>
      </div>

      {result.notes && <p class="text-xs text-muted italic">{result.notes}</p>}
    </div>
  );
}
