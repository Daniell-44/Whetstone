import { useState } from 'preact/hooks';
import type { CounterargumentResult } from '../../lib/counterargument';
import CounterargumentResultDisplay from '../studio/CounterargumentResultDisplay';
import { track } from '../../lib/analytics/track';

// Free, on-demand "strongest opposing case" for the Reader — the merged home of
// the retired standalone /strongest-opposing-case tool (Decision 1, 2026-06-30).
// Runs on the text the audit already ran against, via the free public endpoint.

type Phase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: CounterargumentResult }
  | { status: 'error'; message: string };

export default function ReaderOpposingCase({ text }: { text: string }) {
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });

  async function run() {
    setPhase({ status: 'loading' });
    track('opposing_case_requested' as any, { surface: 'reader' });
    try {
      const res = await fetch('/api/counterargument-public', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });
      const data = await res.json() as
        | { ok: true;  result: CounterargumentResult }
        | { ok: false; error: { code: string; message: string } };
      if (data.ok) setPhase({ status: 'done', result: data.result });
      else         setPhase({ status: 'error', message: data.error.message });
    } catch {
      setPhase({ status: 'error', message: 'Network error - check your connection and try again.' });
    }
  }

  return (
    <div class="rounded-lg border border-hairline bg-surface p-4 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-xs font-semibold uppercase tracking-widest text-muted">Strongest opposing case</h3>
        <span class="text-xs text-accent-support font-medium">Free</span>
      </div>

      {phase.status !== 'done' && (
        <>
          <p class="text-xs text-muted leading-relaxed">
            The 2–3 strongest opposing positions a thoughtful, well-informed opponent would deploy — steelmanned, not strawmanned.
          </p>
          <button
            type="button"
            onClick={() => void run()}
            disabled={phase.status === 'loading'}
            class="w-full py-2 px-4 rounded-lg text-sm font-semibold transition-colors bg-accent text-paper hover:bg-accent/90 disabled:opacity-60"
          >
            {phase.status === 'loading' ? 'Finding the strongest case against…' : 'Find the strongest opposing case'}
          </button>
        </>
      )}

      {phase.status === 'error' && (
        <div class="rounded-lg bg-red-50 border border-red-200 p-3">
          <p class="text-xs text-red-700">{phase.message}</p>
        </div>
      )}

      {phase.status === 'done' && (
        <CounterargumentResultDisplay result={phase.result} />
      )}
    </div>
  );
}
