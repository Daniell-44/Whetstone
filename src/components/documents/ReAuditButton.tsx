import { useState } from 'preact/hooks';

// ---------------------------------------------------------------------------
// "Re-audit latest version" affordance on a draft card in /creator/documents.
//
// POSTs /api/documents/[id]/re-audit, which consumes one audit from the same
// quota bucket as /api/audit (hence the label), stores the result as a new
// version, and returns the finding delta versus the previous audited version.
// Counts only; the full diff view stays on the compare surface.
// ---------------------------------------------------------------------------

interface Delta { newFindings: number; resolved: number }

type Phase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; delta: Delta; hadPreviousAudit: boolean }
  | { status: 'error'; message: string };

export default function ReAuditButton({ docId, quotaPeriod }: { docId: string; quotaPeriod: 'month' | 'day' }) {
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });

  async function run() {
    setPhase({ status: 'loading' });
    try {
      const res  = await fetch(`/api/documents/${encodeURIComponent(docId)}/re-audit`, { method: 'POST' });
      const data = await res.json() as
        | { ok: true; delta: Delta; hadPreviousAudit: boolean }
        | { ok: false; error: { code: string; message: string } };
      if (data.ok) {
        setPhase({ status: 'done', delta: data.delta, hadPreviousAudit: data.hadPreviousAudit });
      } else {
        setPhase({ status: 'error', message: data.error.message });
      }
    } catch {
      setPhase({ status: 'error', message: 'Network error.' });
    }
  }

  if (phase.status === 'done') {
    const { newFindings, resolved } = phase.delta;
    return (
      <p class="text-xs text-ink">
        {phase.hadPreviousAudit ? (
          <>
            <span class={newFindings > 0 ? 'text-accent font-semibold' : 'font-semibold'}>{newFindings} new</span>
            {' finding'}{newFindings === 1 ? '' : 's'}, <span class="font-semibold">{resolved} resolved</span>
          </>
        ) : (
          <>
            First audit stored: <span class={newFindings > 0 ? 'text-accent font-semibold' : 'font-semibold'}>{newFindings}</span> finding{newFindings === 1 ? '' : 's'}
          </>
        )}
        {' · '}
        <a href={`/audit?mode=create&doc=${docId}`} class="text-accent-support hover:underline">open</a>
      </p>
    );
  }

  return (
    <div class="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={phase.status === 'loading'}
        class={`font-mono text-[11px] uppercase tracking-[0.08em] rounded border px-2 py-1 transition-colors ${
          phase.status === 'loading'
            ? 'border-hairline text-muted cursor-wait'
            : 'border-accent-support/40 text-accent-support hover:bg-accent-support/5'
        }`}
      >
        {phase.status === 'loading' ? 'Re-auditing…' : 'Re-audit latest version'}
      </button>
      {phase.status === 'error' ? (
        <span class="text-xs text-red-700">{phase.message}</span>
      ) : (
        <span class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          Uses 1 audit from your {quotaPeriod === 'month' ? 'monthly' : 'daily'} quota
        </span>
      )}
    </div>
  );
}
