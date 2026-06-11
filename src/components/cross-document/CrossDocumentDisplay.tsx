import type { CrossDocumentResult, CrossDocumentFinding } from '../../../functions/_lib/cross-document/types';
import { argumentScore, totalFindingCount } from '../../lib/audit';

const KIND_META: Record<string, { label: string; cls: string }> = {
  self_contradiction:        { label: 'Self-contradiction',        cls: 'bg-red-100    text-red-700'     },
  repeated_unstated_warrant: { label: 'Repeated unstated warrant', cls: 'bg-amber-100  text-amber-700'   },
  shifted_position:          { label: 'Shifted position',          cls: 'bg-orange-100 text-orange-700'  },
  escalating_certainty:      { label: 'Escalating certainty',      cls: 'bg-violet-100 text-violet-700'  },
  consistent_strength:       { label: 'Consistent strength',       cls: 'bg-emerald-100 text-emerald-700'},
  selective_standard:        { label: 'Selective standard',        cls: 'bg-rose-100   text-rose-700'    },
  other:                     { label: 'Pattern',                   cls: 'bg-gray-100   text-gray-700'    },
};

const SEV_CLS: Record<string, string> = {
  high:   'border-red-200   bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low:    'border-gray-200  bg-white',
};

function FindingCard({ f, labelById }: { f: CrossDocumentFinding; labelById: Map<string, string> }) {
  const meta = KIND_META[f.kind] ?? KIND_META.other;
  return (
    <div class={`rounded-lg border p-4 ${SEV_CLS[f.severity] ?? SEV_CLS.low}`}>
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
        <span class="text-[10px] text-gray-400">{f.severity}</span>
        <span class="text-[10px] text-gray-400 ml-auto">{f.confidence}% conf.</span>
      </div>
      <p class="text-sm text-gray-800 leading-relaxed mb-3">{f.description}</p>
      <div class="space-y-2">
        {f.evidence.map((ev, i) => (
          <div key={i} class="rounded bg-white border border-gray-200 px-3 py-2">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              {labelById.get(ev.documentId) ?? ev.documentId}
            </p>
            <blockquote class="text-xs text-gray-600 italic leading-relaxed">"{ev.quote}"</blockquote>
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
            <div key={da.documentId} class="rounded-lg border border-gray-200 bg-white p-3">
              <p class="text-xs font-semibold text-gray-800 truncate mb-1.5" title={da.label}>{da.label}</p>
              <div class="flex items-center gap-3 text-[11px] text-gray-500">
                <span>Score <strong class="text-gray-800">{score}</strong></span>
                <span>·</span>
                <span>{findings} finding{findings === 1 ? '' : 's'}</span>
              </div>
              <p class="text-[11px] text-gray-500 leading-snug mt-1.5 line-clamp-2" title={da.extraction.centralClaim}>
                {da.extraction.centralClaim}
              </p>
            </div>
          );
        })}
      </div>

      {/* Cross-document synthesis */}
      {result.synthesis ? (
        <div class="space-y-4">
          <div class="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 mb-1.5">Overall pattern</p>
            <p class="text-sm text-gray-800 leading-relaxed">{result.synthesis.overallPattern}</p>
          </div>

          {result.synthesis.findings.length === 0 ? (
            <p class="text-sm text-gray-500">No significant cross-document patterns found — the documents are internally consistent.</p>
          ) : (
            <div class="space-y-3">
              <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Cross-document findings ({result.synthesis.findings.length})
              </h3>
              {result.synthesis.findings.map((f, i) => (
                <FindingCard key={i} f={f} labelById={labelById} />
              ))}
            </div>
          )}

          {result.synthesis.notes && (
            <p class="text-xs text-gray-400 italic">{result.synthesis.notes}</p>
          )}
        </div>
      ) : (
        <p class="text-sm text-gray-500">
          Cross-document synthesis was not produced — each document was audited individually above.
        </p>
      )}
    </div>
  );
}
