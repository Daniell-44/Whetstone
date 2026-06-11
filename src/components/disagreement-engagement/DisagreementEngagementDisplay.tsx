import type { DisagreementEngagementResult, OpposingPositionEngagement } from '../../../functions/_lib/disagreement-engagement/types';
import GroundednessChip from '../grounded/GroundednessChip';

const QUALITY_BADGE: Record<string, { label: string; cls: string }> = {
  steelmanned:    { label: 'Steelmanned',         cls: 'bg-emerald-100 text-emerald-700' },
  representative: { label: 'Representative',      cls: 'bg-green-100   text-green-700'   },
  weak_version:   { label: 'Weak version',        cls: 'bg-amber-100   text-amber-700'   },
  strawman:       { label: 'Strawman',            cls: 'bg-red-100     text-red-700'     },
  mentioned_only: { label: 'Mentioned only',      cls: 'bg-orange-100  text-orange-700'  },
  absent:         { label: 'Absent',              cls: 'bg-gray-200    text-gray-700'    },
};

const VERDICT_BADGE: Record<string, { label: string; cls: string }> = {
  rigorous: { label: 'Rigorous engagement', cls: 'bg-emerald-100 text-emerald-700' },
  partial:  { label: 'Partial engagement',  cls: 'bg-amber-100   text-amber-700'   },
  weak:     { label: 'Weak engagement',     cls: 'bg-red-100     text-red-700'     },
  absent:   { label: 'Largely absent',      cls: 'bg-gray-200    text-gray-700'    },
};

function EngagementCard({ e }: { e: OpposingPositionEngagement }) {
  const badge = QUALITY_BADGE[e.quality] ?? QUALITY_BADGE.mentioned_only;
  return (
    <div class="rounded-lg border border-gray-200 bg-white p-4">
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class={`text-[10px] font-medium px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
        <span class="ml-auto"><GroundednessChip groundedness={e.groundedness} compact /></span>
      </div>
      <p class="text-sm text-gray-900 font-medium leading-snug mb-1.5">"{e.position}"</p>
      <p class="text-xs text-gray-600 leading-relaxed mb-2">
        <span class="font-semibold text-gray-800">Author's treatment:</span> {e.authorTreatment}
      </p>
      {e.triggerPassage && (
        <blockquote class="text-xs text-gray-500 border-l-2 border-gray-200 pl-2.5 italic mb-2 leading-relaxed">
          {e.triggerPassage}
        </blockquote>
      )}
      <p class="text-xs text-gray-700 leading-relaxed mb-2">{e.whyThisQuality}</p>
      {e.strongerVersion && (
        <div class="rounded bg-amber-50 border border-amber-200 px-3 py-2 mb-2">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-1">Stronger version to engage with</p>
          <p class="text-xs text-gray-800 leading-relaxed">"{e.strongerVersion}"</p>
        </div>
      )}
      <p class="text-xs text-gray-600 italic leading-relaxed">
        <span class="font-semibold not-italic">If engaged:</span> {e.whatChangesIfEngaged}
      </p>
    </div>
  );
}

export default function DisagreementEngagementDisplay({ result }: { result: DisagreementEngagementResult }) {
  const badge = VERDICT_BADGE[result.overallVerdict] ?? VERDICT_BADGE.partial;
  return (
    <div class="space-y-4">
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <div class="flex items-center gap-2 mb-2">
          <span class={`text-[10px] font-medium px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
        </div>
        <p class="text-sm text-gray-800 leading-relaxed">{result.summary}</p>
      </div>

      {result.engagements.length === 0 ? (
        <p class="text-sm text-gray-400">No significant opposing positions identified.</p>
      ) : (
        <div class="space-y-3">
          {result.engagements.map((e, i) => <EngagementCard key={i} e={e} />)}
        </div>
      )}

      {result.notes && <p class="text-xs text-gray-400 italic">{result.notes}</p>}
    </div>
  );
}
