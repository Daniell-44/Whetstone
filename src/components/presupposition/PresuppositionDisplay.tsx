import type { PresuppositionResult, Presupposition } from '../../../functions/_lib/presupposition/types';
import GroundednessChip from '../grounded/GroundednessChip';

const DOMAIN_LABEL: Record<string, string> = {
  ontological: 'Ontological',
  normative:   'Normative',
  epistemic:   'Epistemic',
  causal:      'Causal',
  categorical: 'Categorical',
  temporal:    'Temporal',
  agent:       'Agent',
  other:       'Other',
};

const CONTEST_BADGE: Record<string, { label: string; cls: string }> = {
  widely_shared:    { label: 'Widely shared',    cls: 'bg-emerald-100 text-emerald-700' },
  community_shared: { label: 'Community-shared', cls: 'bg-sky-100 text-sky-700' },
  contested:        { label: 'Contested',        cls: 'bg-amber-100 text-amber-700' },
  minority:         { label: 'Minority view',    cls: 'bg-red-100 text-red-700' },
};

function PresupCard({ p }: { p: Presupposition }) {
  const badge = CONTEST_BADGE[p.contestability] ?? CONTEST_BADGE.contested;
  return (
    <div class="rounded-lg border border-hairline bg-surface p-4">
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class="text-xs font-semibold uppercase tracking-widest text-accent">{DOMAIN_LABEL[p.domain] ?? p.domain}</span>
        <span class={`text-xs font-medium px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
        <span class="ml-auto"><GroundednessChip groundedness={p.groundedness} compact /></span>
      </div>
      <p class="text-sm text-ink-strong font-medium leading-snug mb-2">"{p.statement}"</p>
      <blockquote class="text-xs text-muted border-l-2 border-hairline pl-2.5 italic mb-2 leading-relaxed">
        {p.triggerPassage}
      </blockquote>
      <p class="text-xs text-ink leading-relaxed mb-2">{p.whyItMatters}</p>
      {p.alternatives.length > 0 && (
        <div class="text-xs text-muted">
          <span class="font-semibold text-ink">Alternative frames:</span>{' '}
          {p.alternatives.join(' · ')}
        </div>
      )}
    </div>
  );
}

export default function PresuppositionDisplay({ result }: { result: PresuppositionResult }) {
  return (
    <div class="space-y-4">
      <div class="rounded-lg border border-accent/20 bg-accent/5/60 p-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-accent mb-1.5">Implied audience</p>
        <p class="text-sm text-ink leading-relaxed">{result.audienceProfile}</p>
      </div>

      {result.presuppositions.length === 0 ? (
        <p class="text-sm text-muted">No clear presuppositions identified.</p>
      ) : (
        <div class="space-y-3">
          {result.presuppositions.map((p, i) => <PresupCard key={i} p={p} />)}
        </div>
      )}

      {result.notes && (
        <p class="text-xs text-muted italic">{result.notes}</p>
      )}
    </div>
  );
}
