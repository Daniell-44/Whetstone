// ---------------------------------------------------------------------------
// VersionTrajectory - compact per-version audit readout plus a one-click
// "Latest vs Original" compare, rendered above the versions list.
//
// The page passes the list only hasAudit flags, so the finding counts are
// fetched client-side from the existing GET /api/documents/[id]/versions
// (whose rows carry the persisted audit_result JSON). No new endpoints.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'preact/hooks';
import type { VersionRow } from './VersionsList';
import type { AuditResult } from '../../lib/audit';
import { totalFindingCount, severityBreakdown } from '../../lib/audit';

interface Point {
  id:             string;
  version_number: number;
  total:          number;
  high:           number;
}

interface ApiVersion {
  id:             string;
  version_number: number;
  audit_result:   string | null;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'done'; points: Point[] }
  | { status: 'error' };

interface Props {
  docId:    string;
  versions: VersionRow[];
}

export default function VersionTrajectory({ docId, versions }: Props) {
  const audited = versions
    .filter(v => v.hasAudit)
    .sort((a, b) => a.version_number - b.version_number);

  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    if (audited.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`/api/documents/${docId}/versions`);
        const data = await res.json() as { ok: boolean; versions?: ApiVersion[] };
        if (cancelled) return;
        if (!data.ok || !data.versions) { setState({ status: 'error' }); return; }
        const points: Point[] = [];
        for (const v of data.versions) {
          if (!v.audit_result) continue;
          try {
            const audit = JSON.parse(v.audit_result) as AuditResult;
            points.push({
              id:             v.id,
              version_number: v.version_number,
              total:          totalFindingCount(audit),
              high:           severityBreakdown(audit).high,
            });
          } catch { /* corrupt stored JSON: skip the row, keep the rest */ }
        }
        points.sort((a, b) => a.version_number - b.version_number);
        setState({ status: 'done', points });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  if (audited.length === 0) return null;

  const oldest          = audited[0]!;
  const newest          = audited[audited.length - 1]!;
  const canQuickCompare = audited.length >= 2;

  function handleQuickCompare() {
    if (!canQuickCompare) return;
    window.location.href = `/creator/documents/${docId}/compare?from=${oldest.id}&to=${newest.id}`;
  }

  const points   = state.status === 'done' ? state.points : [];
  const maxTotal = points.reduce((max, p) => Math.max(max, p.total), 0);

  return (
    <div class="rounded-xl border border-hairline bg-surface px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Audit trajectory</h2>
        {canQuickCompare && (
          <button
            type="button"
            onClick={handleQuickCompare}
            title={`Compare v${oldest.version_number} against v${newest.version_number}`}
            class="shrink-0 rounded-lg border border-accent-support/40 px-3 py-1.5 text-xs font-medium text-accent-support hover:bg-accent-support hover:text-white transition-colors"
          >
            Latest vs Original
          </button>
        )}
      </div>

      {state.status === 'loading' && (
        <p class="font-mono text-[11px] text-muted py-2">Loading audit history…</p>
      )}
      {state.status === 'error' && (
        <p class="font-mono text-[11px] text-muted py-2">Audit history unavailable.</p>
      )}
      {state.status === 'done' && points.length === 0 && (
        <p class="font-mono text-[11px] text-muted py-2">No stored audit data on these versions.</p>
      )}

      {state.status === 'done' && points.length > 0 && (
        <ol class="mt-2 divide-y divide-hairline">
          {points.map(p => (
            <li key={p.id} class="flex items-center gap-3 py-1.5 font-mono text-[11px]">
              <span class="w-8 shrink-0 text-ink">v{p.version_number}</span>
              {/* Proportional bar: length tracks total findings against the
                 chain's worst version, so a shrinking bar reads as progress. */}
              <span class="flex-1 h-[3px] rounded-full bg-hairline/40 overflow-hidden" aria-hidden="true">
                <span
                  class="block h-full bg-ink/30"
                  style={{ width: `${maxTotal > 0 ? Math.round((p.total / maxTotal) * 100) : 0}%` }}
                />
              </span>
              <span class={`w-20 shrink-0 text-right ${p.total > 0 ? 'text-accent' : 'text-muted'}`}>
                {p.total} finding{p.total === 1 ? '' : 's'}
              </span>
              <span class={`w-12 shrink-0 text-right ${p.high > 0 ? 'text-sev-high' : 'text-muted'}`}>
                {p.high} high
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
