import { useState, useEffect } from 'preact/hooks';

// Shared single-audit loading state for the Reader-flavoured surfaces (AuditForm
// and the /labs/workbench prototype, and the future merged Read mode): an eased
// progress bar (fast-then-slow toward ~90%, never completing until the result
// lands) plus a skeleton of the result layout. Research: for 10s+ waits a bar +
// skeleton beats a spinner — it reduces perceived wait and signals the structure
// that's coming.
//
// NOT used by Studio: its five concurrent engines have a legitimately different,
// section-granular loading system (skeletonPanel + per-section SectionLoading)
// that suits its multi-panel layout — sharing this here would regress it.
export default function AuditLoading() {
  const [pct, setPct] = useState(8);
  useEffect(() => {
    const id = setInterval(() => {
      setPct(p => (p >= 90 ? 90 : p + (90 - p) * 0.05));
    }, 350);
    return () => clearInterval(id);
  }, []);

  return (
    <div class="space-y-4">
      <div class="rounded-xl border border-accent/20 bg-accent/5 p-4">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-medium text-accent">Reading and analysing the argument…</p>
          <span class="text-xs text-accent/70 tabular-nums">{Math.round(pct)}%</span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-accent/10 overflow-hidden">
          <div class="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={`width:${pct}%`} />
        </div>
        <p class="text-xs text-accent/70 mt-2">Mapping the structure and checking for logical issues, usually 10–20 seconds.</p>
      </div>

      <div class="flex flex-col xl:flex-row gap-4 items-start">
        <div class="w-full xl:w-[55%] rounded-lg border border-hairline bg-surface p-4 space-y-2.5">
          <div class="h-2.5 w-1/3 rounded bg-hairline animate-pulse" />
          <div class="h-2 w-full rounded bg-hairline/40 animate-pulse" />
          <div class="h-2 w-11/12 rounded bg-hairline/40 animate-pulse" />
          <div class="h-2 w-5/6 rounded bg-hairline/40 animate-pulse" />
          <div class="h-2 w-full rounded bg-hairline/40 animate-pulse" />
          <div class="h-2 w-2/3 rounded bg-hairline/40 animate-pulse" />
        </div>
        <div class="w-full xl:w-[45%] rounded-lg border border-hairline bg-surface p-4 space-y-3">
          <div class="h-2.5 w-1/4 rounded bg-hairline animate-pulse" />
          {[0, 1, 2].map(i => (
            <div key={i} class="rounded-md border border-hairline p-2.5 space-y-1.5">
              <div class="h-2 w-1/2 rounded bg-hairline animate-pulse" />
              <div class="h-2 w-full rounded bg-hairline/40 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
