import { useState, useEffect, useRef } from 'preact/hooks';
import { SAMPLES, type Sample } from '../../data/samples';
import { track } from '../../lib/analytics/track';

interface Props {
  onPick: (sample: Sample) => void;
  disabled?: boolean;
}

export default function SamplePicker({ onPick, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={containerRef} class="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        class="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium text-muted border border-hairline hover:bg-paper hover:text-ink transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        Try an example
        <svg class={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div class="absolute z-30 right-0 sm:right-auto sm:left-0 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-hairline bg-surface shadow-lg overflow-hidden">
          <div class="px-4 py-2.5 border-b border-hairline bg-paper">
            <p class="text-xs font-semibold uppercase tracking-widest text-muted">Pre-cached examples</p>
            <p class="text-xs text-muted mt-0.5 leading-snug">Pick a sample to see the analysis instantly - no API call.</p>
          </div>
          <ul class="divide-y divide-hairline">
            {SAMPLES.map((s) => (
              <li>
                <button
                  type="button"
                  onClick={() => { track('sample_picked', { sample_id: s.id }); onPick(s); setOpen(false); }}
                  class="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors"
                >
                  <div class="flex items-baseline justify-between gap-2">
                    <p class="text-sm font-semibold text-ink-strong">{s.shortLabel}</p>
                    <p class="text-xs uppercase tracking-wider text-muted shrink-0">{s.category}</p>
                  </div>
                  <p class="text-xs text-muted mt-1 leading-snug">{s.title}</p>
                  <div class="flex flex-wrap gap-1 mt-2">
                    {s.failureModes.slice(0, 3).map((mode) => (
                      <span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                        {mode}
                      </span>
                    ))}
                    {s.failureModes.length > 3 && (
                      <span class="text-xs px-1.5 py-0.5 rounded bg-hairline/40 text-muted font-medium">
                        +{s.failureModes.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
