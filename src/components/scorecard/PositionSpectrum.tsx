import { leaningStyle, spectrumPosition } from '../topic/types';

// ---------------------------------------------------------------------------
// PositionSpectrum — places a Briefing's positions left→right on a single
// gradient rail. Renders only when at least two positions carry a leaning;
// legacy scorecards without leanings simply don't show it.
// ---------------------------------------------------------------------------

interface PositionDot {
  label:   string;
  leaning: number;
}

export default function PositionSpectrum({ positions }: { positions: { label: string; leaning?: number }[] }) {
  const placed: PositionDot[] = positions
    .filter((p): p is { label: string; leaning: number } => typeof p.leaning === 'number')
    .map(p => ({ label: p.label, leaning: p.leaning }));

  if (placed.length < 2) return null;

  return (
    <div class="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 mb-8">
      <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Where the positions sit</p>

      <div class="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
        <span>Left</span><span>Center</span><span>Right</span>
      </div>
      <div class="relative h-2 rounded-full bg-gradient-to-r from-red-200 via-gray-200 to-blue-200">
        {placed.map((p, i) => {
          const st = leaningStyle(p.leaning);
          return (
            <div
              key={i}
              class={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white ${st.dot}`}
              style={`left: ${spectrumPosition(p.leaning)}%`}
              title={`${p.label}: ${st.label}`}
            />
          );
        })}
      </div>

      {/* Legend: each position with its placement */}
      <ul class="mt-4 space-y-1.5">
        {placed.map((p, i) => {
          const st = leaningStyle(p.leaning);
          return (
            <li key={i} class="flex items-center gap-2 text-xs text-gray-600">
              <span class={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot}`} />
              <span class="font-medium text-gray-800">{p.label}</span>
              <span class="text-gray-400">· {st.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
