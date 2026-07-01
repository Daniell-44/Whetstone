import type { CrossDocumentResult, CrossDocumentFinding } from '../../../functions/_lib/cross-document/types';
import { argumentScore, totalFindingCount } from '../../lib/audit';

const KIND_META: Record<string, { label: string; cls: string }> = {
  self_contradiction:        { label: 'Self-contradiction',        cls: 'bg-red-100    text-red-700'     },
  repeated_unstated_warrant: { label: 'Repeated unstated warrant', cls: 'bg-amber-100  text-amber-700'   },
  shifted_position:          { label: 'Shifted position',          cls: 'bg-orange-100 text-orange-700'  },
  escalating_certainty:      { label: 'Escalating certainty',      cls: 'bg-violet-100 text-violet-700'  },
  consistent_strength:       { label: 'Consistent strength',       cls: 'bg-emerald-100 text-emerald-700'},
  selective_standard:        { label: 'Selective standard',        cls: 'bg-rose-100   text-rose-700'    },
  other:                     { label: 'Pattern',                   cls: 'bg-hairline/40   text-ink'    },
};

const SEV_CLS: Record<string, string> = {
  high:   'border-red-200   bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low:    'border-hairline  bg-surface',
};

function FindingCard({ f, labelById }: { f: CrossDocumentFinding; labelById: Map<string, string> }) {
  const meta = KIND_META[f.kind] ?? KIND_META.other;
  return (
    <div class={`rounded-lg border p-4 ${SEV_CLS[f.severity] ?? SEV_CLS.low}`}>
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
        <span class="text-xs text-muted">{f.severity}</span>
        <span class="text-xs text-muted ml-auto">{f.confidence}% conf.</span>
      </div>
      <p class="text-sm text-ink leading-relaxed mb-3">{f.description}</p>
      <div class="space-y-2">
        {f.evidence.map((ev, i) => (
          <div key={i} class="rounded bg-surface border border-hairline px-3 py-2">
            <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-1">
              {labelById.get(ev.documentId) ?? ev.documentId}
            </p>
            <blockquote class="text-xs text-ink italic leading-relaxed">"{ev.quote}"</blockquote>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CrossDocumentDisplay({ result }: { result: CrossDocumentResult }) {
  const labelById = new Map(result.documentAudits.map(d => [d.documentId, d.label]));

  return (
    <div class="space-y-6">
      {/* Per-document summary strip */}
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {result.documentAudits.map((da) => {
          const score = argumentScore(da.audit);
          const findings = totalFindingCount(da.audit);
          return (
            <div key={da.documentId} class="rounded-lg border border-hairline bg-surface p-3">
              <p class="text-xs font-semibold text-ink truncate mb-1.5" title={da.label}>{da.label}</p>
              <div class="flex items-center gap-3 text-xs text-muted">
                <span>Score <strong class="text-ink">{score}</strong></span>
                <span>·</span>
                <span>{findings} finding{findings === 1 ? '' : 's'}</span>
              </div>
              <p class="text-xs text-muted leading-snug mt-1.5 line-clamp-2" title={da.extraction.centralClaim}>
                {da.extraction.centralClaim}
              </p>
            </div>
          );
        })}
      </div>

      {/* Cross-document synthesis */}
      {result.synthesis ? (
        <div class="space-y-4">
          <div class="rounded-lg border border-accent/30 bg-accent/5/50 p-4">
            <p class="text-xs font-semibold uppercase tracking-widest text-accent mb-1.5">Overall pattern</p>
            <p class="text-sm text-ink leading-relaxed">{result.synthesis.overallPattern}</p>
          </div>

          {result.synthesis.findings.length === 0 ? (
            <p class="text-sm text-muted">No significant cross-document patterns found - the documents are internally consistent.</p>
          ) : (
            <div class="space-y-3">
              <h3 class="text-xs font-semibold uppercase tracking-widest text-muted">
                Cross-document findings ({result.synthesis.findings.length})
              </h3>
              {result.synthesis.findings.map((f, i) => (
                <FindingCard key={i} f={f} labelById={labelById} />
              ))}
            </div>
          )}

          {result.synthesis.notes && (
            <p class="text-xs text-muted italic">{result.synthesis.notes}</p>
          )}
        </div>
      ) : (
        <p class="text-sm text-muted">
          Cross-document synthesis was not produced - each document was audited individually above.
        </p>
      )}
    </div>
  );
}
