import { useState, useMemo, useCallback } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import { kindWeight, type GroundednessSignal } from '../../../functions/_lib/grounded/types';

// ---------------------------------------------------------------------------
// HeatmapDraft - density-aware overlay
//
// Inline highlights show one finding per passage (highest-severity wins on
// overlaps). The heatmap instead shows the *density* of findings: every
// character position is assigned a cumulative weight equal to the sum of
// severity-weighted confidence across all findings whose quote covers it.
// Hot regions are where the writer's prose is doing the most argumentative
// work (or where the engine is flagging the most).
// ---------------------------------------------------------------------------

interface Contribution {
  start:        number;
  end:          number;
  quote:        string;
  lens:         string;
  label:        string;
  explanation:  string;
  severity:     'high' | 'medium' | 'low';
  groundedness: GroundednessSignal;
  weight:       number;
  matchKey:     string;
}

interface Props {
  text:           string;
  audit:          AuditResult;
  onFindingClick?: (matchKey: string) => void;
}

// ---------------------------------------------------------------------------
// Severity weighting
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

function contributionWeight(severity: string, g: GroundednessSignal): number {
  const sev = SEVERITY_WEIGHT[severity] ?? 1;
  return sev * kindWeight(g);
}

// ---------------------------------------------------------------------------
// Extract every quotable contribution from the audit (no dedup - heatmap
// wants all overlapping findings).
// ---------------------------------------------------------------------------

function extractContributions(text: string, audit: AuditResult): Contribution[] {
  const out: Contribution[] = [];

  const push = (quote: string, lens: string, label: string, explanation: string, severity: 'high' | 'medium' | 'low', g: GroundednessSignal, matchKey: string) => {
    const idx = text.indexOf(quote);
    if (idx === -1 || quote.length < 5) return;
    out.push({
      start:        idx,
      end:          idx + quote.length,
      quote,
      lens,
      label,
      explanation,
      severity,
      groundedness: g,
      weight:       contributionWeight(severity, g),
      matchKey,
    });
  };

  for (const f of audit.namedFallacies) {
    push(f.quote, 'fallacy', f.name, f.explanation, f.severity, f.groundedness,
      `namedFallacies:${f.name}:${f.quote.slice(0, 40)}`);
  }
  for (const l of audit.loadedLanguage) {
    push(l.phrase, 'loaded', l.technique, l.explanation, l.severity, l.groundedness,
      `loadedLanguage:${l.technique}:${l.phrase.slice(0, 40)}`);
  }
  for (const k of audit.keyTermScrutiny) {
    push(k.usage_a, 'keyterm', `Term shift: "${k.term}"`, k.explanation, k.severity, k.groundedness,
      `keyTermScrutiny:${k.term}:${k.usage_a.slice(0, 40)}`);
    push(k.usage_b, 'keyterm', `Term shift: "${k.term}"`, k.explanation, k.severity, k.groundedness,
      `keyTermScrutiny:${k.term}:${k.usage_a.slice(0, 40)}`);
  }
  for (const r of audit.referentChecks) {
    push(r.evidence, 'referent', `Vague reference: "${r.phrase}"`, r.explanation, r.severity, r.groundedness,
      `referentChecks:${r.phrase}:${r.evidence.slice(0, 40)}`);
  }
  for (const f of audit.falsifiabilityChecks) {
    push(f.evidence, 'falsifiability', `Unfalsifiable: "${f.claim.slice(0, 40)}…"`, f.explanation, f.severity, f.groundedness,
      `falsifiabilityChecks:${f.claim.slice(0, 30)}:${f.evidence.slice(0, 40)}`);
  }
  for (const m of audit.modalScopeChecks) {
    push(m.evidence, 'modal', `Modal inflation: "${m.inflatedModal}"`, m.explanation, m.severity, m.groundedness,
      `modalScopeChecks:${m.claim.slice(0, 30)}:${m.evidence.slice(0, 40)}`);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Build per-character heat array and compress into runs
// ---------------------------------------------------------------------------

interface Run {
  start:          number;
  end:            number;
  weight:         number;
  contributions:  Contribution[];
}

function buildRuns(text: string, contributions: Contribution[]): Run[] {
  // For each character position: (weight, set of contributing finding ids)
  const weights = new Float32Array(text.length);
  const byChar: Array<Set<number>> = new Array(text.length);
  for (let i = 0; i < text.length; i++) byChar[i] = new Set();

  contributions.forEach((c, idx) => {
    for (let i = c.start; i < c.end; i++) {
      weights[i] = (weights[i] ?? 0) + c.weight;
      byChar[i]!.add(idx);
    }
  });

  // Compress: walk the array, group adjacent positions sharing the same
  // (weight, contributing-finding-set) signature.
  const runs: Run[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const w = weights[cursor]!;
    const set = byChar[cursor]!;
    let end = cursor + 1;
    while (
      end < text.length &&
      weights[end] === w &&
      byChar[end]!.size === set.size &&
      [...byChar[end]!].every(i => set.has(i))
    ) {
      end++;
    }
    runs.push({
      start:         cursor,
      end,
      weight:        w,
      contributions: [...set].map(i => contributions[i]!),
    });
    cursor = end;
  }

  return runs;
}

// ---------------------------------------------------------------------------
// Colour scale - transparent at 0, then yellow → orange → red → deep red
// ---------------------------------------------------------------------------

function heatColour(weight: number, max: number): string {
  if (weight === 0 || max === 0) return 'transparent';
  const ratio = Math.min(1, weight / max);

  // hue 50° (yellow) → 0° (red); saturation high, lightness drops with intensity
  const hue       = 50 - (ratio * 50);          // 50 → 0
  const lightness = 80 - (ratio * 30);          // 80% → 50%
  const alpha     = 0.25 + (ratio * 0.55);      // 0.25 → 0.80

  return `hsla(${hue}, 95%, ${lightness}%, ${alpha.toFixed(2)})`;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function HeatTooltip({ run, x, y }: { run: Run; x: number; y: number }) {
  return (
    <div
      class="fixed z-50 max-w-md rounded-lg border border-gray-200 bg-white shadow-xl p-3 pointer-events-none text-xs"
      style={`left: ${Math.min(x + 12, window.innerWidth - 420)}px; top: ${y + 16}px;`}
    >
      <p class="font-semibold text-gray-900 mb-2">
        {run.contributions.length} finding{run.contributions.length !== 1 ? 's' : ''} overlap here · density {run.weight.toFixed(1)}
      </p>
      <ul class="space-y-1.5">
        {run.contributions.map((c, i) => (
          <li key={i} class="flex items-start gap-2">
            <span class={`shrink-0 inline-block w-1.5 h-1.5 rounded-full mt-1 ${
              c.severity === 'high'   ? 'bg-red-500' :
              c.severity === 'medium' ? 'bg-amber-500' :
                                        'bg-gray-400'
            }`} />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-800">{c.label}</p>
              <p class="text-[10px] text-gray-500">{c.severity} · structural</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heat legend
// ---------------------------------------------------------------------------

function HeatLegend({ max }: { max: number }) {
  if (max === 0) return null;
  const stops = [0.1, 0.3, 0.5, 0.75, 1.0];
  return (
    <div class="flex items-center gap-2 text-[10px] text-gray-500">
      <span>cool</span>
      <div class="flex h-2.5 rounded-full overflow-hidden border border-gray-200">
        {stops.map((s, i) => (
          <div key={i} style={`width: 24px; background: ${heatColour(s * max, max)};`} />
        ))}
      </div>
      <span>hot ({max.toFixed(1)} max)</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HeatmapDraft({ text, audit, onFindingClick }: Props) {
  const [hoveredRun, setHoveredRun] = useState<Run | null>(null);
  const [hoverPos,   setHoverPos]   = useState({ x: 0, y: 0 });

  const { runs, max, total } = useMemo(() => {
    const contributions = extractContributions(text, audit);
    const r = buildRuns(text, contributions);
    const m = r.reduce((acc, run) => Math.max(acc, run.weight), 0);
    return { runs: r, max: m, total: contributions.length };
  }, [text, audit]);

  const handleEnter = useCallback((run: Run, e: MouseEvent) => {
    if (run.weight === 0) return;
    setHoveredRun(run);
    setHoverPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredRun(null);
  }, []);

  const handleRunClick = useCallback((run: Run) => {
    if (run.weight === 0 || !onFindingClick) return;
    // Pick the highest-severity contribution to scroll to; ties broken by groundedness weight
    const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = [...run.contributions].sort((a, b) =>
      (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3) ||
      kindWeight(b.groundedness) - kindWeight(a.groundedness),
    );
    const top = sorted[0];
    if (top) onFindingClick(top.matchKey);
  }, [onFindingClick]);

  // Find the hottest run for a "jump to densest passage" CTA
  const hottest = runs.reduce<Run | null>((acc, r) => (r.weight > (acc?.weight ?? 0) ? r : acc), null);

  return (
    <div class="relative">

      {/* Header */}
      <div class="flex items-center justify-between gap-3 mb-3 text-xs flex-wrap">
        <div class="flex items-center gap-3 text-gray-500">
          <span>
            <strong class="text-gray-900">{total}</strong> overlapping finding{total !== 1 ? 's' : ''}
          </span>
          {hottest && hottest.weight > 0 && (
            <>
              <span class="text-gray-300">·</span>
              <span>
                Densest passage carries <strong class="text-gray-900">{hottest.contributions.length}</strong> stacked finding{hottest.contributions.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
        <HeatLegend max={max} />
      </div>

      {/* Text with heatmap overlay */}
      <div class="rounded-lg border border-gray-200 bg-white px-5 py-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-serif select-text overflow-y-auto" style={{ minHeight: 'calc(100vh - 22rem)' }}>
        {runs.map((run, i) => (
          <span
            key={i}
            class={run.weight > 0 ? 'cursor-pointer' : ''}
            style={`background: ${heatColour(run.weight, max)}; ${run.weight > 0 ? 'border-radius: 2px; padding: 0 1px;' : ''}`}
            onMouseEnter={(e: MouseEvent) => handleEnter(run, e)}
            onMouseLeave={handleLeave}
            onMouseMove={(e: MouseEvent) => {
              if (run.weight > 0) setHoverPos({ x: e.clientX, y: e.clientY });
            }}
            onClick={() => handleRunClick(run)}
          >
            {text.slice(run.start, run.end)}
          </span>
        ))}
      </div>

      {hoveredRun && hoveredRun.weight > 0 && (
        <HeatTooltip run={hoveredRun} x={hoverPos.x} y={hoverPos.y} />
      )}

      {/* Empty state */}
      {total === 0 && (
        <p class="text-xs text-gray-400 italic mt-3 text-center">
          No findings to map. The audit didn't flag any quotable issues in this draft.
        </p>
      )}
    </div>
  );
}
