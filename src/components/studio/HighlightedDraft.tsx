import { useState, useRef, useCallback, useMemo } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import type { GroundednessSignal } from '../../../functions/_lib/grounded/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Highlight {
  start:        number;
  end:          number;
  quote:        string;
  lens:         string;
  label:        string;
  explanation:  string;
  severity:     'high' | 'medium' | 'low';
  groundedness: GroundednessSignal;
  matchKey:     string;
}

interface Props {
  text:             string;
  audit:            AuditResult;
  activeFindingKey: string | null;
  onHighlightClick: (matchKey: string) => void;
}

// ---------------------------------------------------------------------------
// Severity colours
// ---------------------------------------------------------------------------

const SEVERITY_BG: Record<string, string> = {
  high:   'bg-red-200/60 hover:bg-red-300/70 border-b-2 border-red-400',
  medium: 'bg-amber-200/50 hover:bg-amber-300/60 border-b-2 border-amber-400',
  low:    'bg-gray-200/50 hover:bg-gray-300/60 border-b-2 border-gray-400',
};

const SEVERITY_ACTIVE: Record<string, string> = {
  high:   'bg-red-300/80 ring-2 ring-red-400',
  medium: 'bg-amber-300/70 ring-2 ring-amber-400',
  low:    'bg-gray-300/70 ring-2 ring-gray-400',
};

// ---------------------------------------------------------------------------
// Extract highlights from audit result
// ---------------------------------------------------------------------------

function extractHighlights(text: string, audit: AuditResult): Highlight[] {
  const highlights: Highlight[] = [];

  // Named fallacies — have `quote` field
  for (const f of audit.namedFallacies) {
    const idx = text.indexOf(f.quote);
    if (idx === -1) continue;
    highlights.push({
      start:       idx,
      end:         idx + f.quote.length,
      quote:       f.quote,
      lens:        'namedFallacies',
      label:       f.name,
      explanation: f.explanation,
      severity:    f.severity,
      groundedness: f.groundedness,
      matchKey:    `namedFallacies:${f.name}:${f.quote.slice(0, 40)}`,
    });
  }

  // Loaded language — have `phrase` field
  for (const l of audit.loadedLanguage) {
    const idx = text.indexOf(l.phrase);
    if (idx === -1) continue;
    highlights.push({
      start:       idx,
      end:         idx + l.phrase.length,
      quote:       l.phrase,
      lens:        'loadedLanguage',
      label:       l.technique,
      explanation: l.explanation,
      severity:    l.severity,
      groundedness: l.groundedness,
      matchKey:    `loadedLanguage:${l.technique}:${l.phrase.slice(0, 40)}`,
    });
  }

  // Key-term scrutiny — have usage_a and usage_b
  for (const k of audit.keyTermScrutiny) {
    for (const usage of [k.usage_a, k.usage_b]) {
      const idx = text.indexOf(usage);
      if (idx === -1) continue;
      highlights.push({
        start:       idx,
        end:         idx + usage.length,
        quote:       usage,
        lens:        'keyTermScrutiny',
        label:       `Term shift: "${k.term}"`,
        explanation: k.explanation,
        severity:    k.severity,
        groundedness: k.groundedness,
        matchKey:    `keyTermScrutiny:${k.term}:${k.usage_a.slice(0, 40)}`,
      });
    }
  }

  // Referent checks — have `evidence` field
  for (const r of audit.referentChecks) {
    const idx = text.indexOf(r.evidence);
    if (idx === -1) continue;
    highlights.push({
      start:       idx,
      end:         idx + r.evidence.length,
      quote:       r.evidence,
      lens:        'referentChecks',
      label:       `Vague reference: "${r.phrase}"`,
      explanation: r.explanation,
      severity:    r.severity,
      groundedness: r.groundedness,
      matchKey:    `referentChecks:${r.phrase}:${r.evidence.slice(0, 40)}`,
    });
  }

  // Falsifiability checks — have `evidence` field
  for (const f of audit.falsifiabilityChecks) {
    const idx = text.indexOf(f.evidence);
    if (idx === -1) continue;
    highlights.push({
      start:       idx,
      end:         idx + f.evidence.length,
      quote:       f.evidence,
      lens:        'falsifiabilityChecks',
      label:       `Unfalsifiable: "${f.claim.slice(0, 30)}…"`,
      explanation: f.explanation,
      severity:    f.severity,
      groundedness: f.groundedness,
      matchKey:    `falsifiabilityChecks:${f.claim.slice(0, 30)}:${f.evidence.slice(0, 40)}`,
    });
  }

  // Modal scope checks — have `evidence` field
  for (const m of audit.modalScopeChecks) {
    const idx = text.indexOf(m.evidence);
    if (idx === -1) continue;
    highlights.push({
      start:       idx,
      end:         idx + m.evidence.length,
      quote:       m.evidence,
      lens:        'modalScopeChecks',
      label:       `Modal inflation: "${m.inflatedModal}" → "${m.impliedModal}"`,
      explanation: m.explanation,
      severity:    m.severity,
      groundedness: m.groundedness,
      matchKey:    `modalScopeChecks:${m.claim.slice(0, 30)}:${m.evidence.slice(0, 40)}`,
    });
  }

  // Sort by position, then by severity (high first for overlaps)
  highlights.sort((a, b) => a.start - b.start || (a.severity === 'high' ? -1 : b.severity === 'high' ? 1 : 0));

  return highlights;
}

// ---------------------------------------------------------------------------
// Resolve overlaps — keep highest-severity highlight for overlapping regions
// ---------------------------------------------------------------------------

function resolveOverlaps(highlights: Highlight[]): Highlight[] {
  if (highlights.length === 0) return [];

  const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const resolved: Highlight[] = [highlights[0]!];

  for (let i = 1; i < highlights.length; i++) {
    const current = highlights[i]!;
    const last    = resolved[resolved.length - 1]!;

    if (current.start < last.end) {
      // Overlap — keep the one with higher severity
      const currentRank = SEVERITY_RANK[current.severity] ?? 2;
      const lastRank    = SEVERITY_RANK[last.severity] ?? 2;
      if (currentRank < lastRank) {
        resolved[resolved.length - 1] = current;
      }
      // else keep `last`
    } else {
      resolved.push(current);
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Hover card
// ---------------------------------------------------------------------------

function HoverCard({ highlight, x, y }: { highlight: Highlight; x: number; y: number }) {
  const severityColour: Record<string, string> = {
    high:   'border-red-300 bg-red-50',
    medium: 'border-amber-300 bg-amber-50',
    low:    'border-gray-300 bg-gray-50',
  };

  return (
    <div
      class={`fixed z-50 max-w-sm rounded-lg border shadow-lg p-3 text-xs leading-relaxed pointer-events-none ${severityColour[highlight.severity] ?? 'border-gray-300 bg-white'}`}
      style={{ left: `${Math.min(x, window.innerWidth - 360)}px`, top: `${y + 16}px` }}
    >
      <p class="font-semibold text-gray-900 mb-1">{highlight.label}</p>
      <p class="text-gray-600">{highlight.explanation}</p>
      <div class="flex items-center gap-2 mt-2">
        <span class={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
          highlight.severity === 'high' ? 'bg-red-100 text-red-700' :
          highlight.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
          'bg-gray-100 text-gray-600'
        }`}>{highlight.severity}</span>
        <span class="text-gray-400">structural</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HighlightedDraft({ text, audit, activeFindingKey, onHighlightClick }: Props) {
  const [hoveredHighlight, setHoveredHighlight] = useState<Highlight | null>(null);
  const [hoverPos, setHoverPos]                 = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const highlights = useMemo(
    () => resolveOverlaps(extractHighlights(text, audit)),
    [text, audit],
  );

  const handleMouseEnter = useCallback((h: Highlight, e: MouseEvent) => {
    setHoveredHighlight(h);
    setHoverPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredHighlight(null);
  }, []);

  // Build the rendered segments
  const segments: preact.JSX.Element[] = [];
  let cursor = 0;

  for (const h of highlights) {
    // Text before this highlight
    if (h.start > cursor) {
      segments.push(
        <span key={`t-${cursor}`}>{text.slice(cursor, h.start)}</span>,
      );
    }

    const isActive = activeFindingKey === h.matchKey;
    const cls = isActive
      ? SEVERITY_ACTIVE[h.severity] ?? ''
      : SEVERITY_BG[h.severity] ?? '';

    segments.push(
      <mark
        key={`h-${h.start}`}
        class={`cursor-pointer rounded-sm px-0.5 transition-all duration-150 ${cls}`}
        data-match-key={h.matchKey}
        onClick={() => onHighlightClick(h.matchKey)}
        onMouseEnter={(e: MouseEvent) => handleMouseEnter(h, e)}
        onMouseLeave={handleMouseLeave}
      >
        {text.slice(h.start, h.end)}
      </mark>,
    );

    cursor = h.end;
  }

  // Remaining text after last highlight
  if (cursor < text.length) {
    segments.push(
      <span key={`t-${cursor}`}>{text.slice(cursor)}</span>,
    );
  }

  const highlightCount = highlights.length;
  const highCount   = highlights.filter(h => h.severity === 'high').length;
  const mediumCount = highlights.filter(h => h.severity === 'medium').length;
  const lowCount    = highlights.filter(h => h.severity === 'low').length;

  return (
    <div ref={containerRef} class="relative">
      {/* Summary bar */}
      {highlightCount > 0 && (
        <div class="flex items-center gap-3 mb-3 text-xs text-gray-500">
          <span>{highlightCount} finding{highlightCount !== 1 ? 's' : ''} highlighted</span>
          {highCount > 0 && (
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-red-400" />
              {highCount} high
            </span>
          )}
          {mediumCount > 0 && (
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-400" />
              {mediumCount} medium
            </span>
          )}
          {lowCount > 0 && (
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-gray-400" />
              {lowCount} low
            </span>
          )}
        </div>
      )}

      {/* Draft text with highlights */}
      <div class="rounded-lg border border-gray-200 bg-white px-5 py-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-serif select-text overflow-y-auto" style={{ minHeight: 'calc(100vh - 22rem)' }}>
        {segments}
      </div>

      {/* Hover card */}
      {hoveredHighlight && (
        <HoverCard highlight={hoveredHighlight} x={hoverPos.x} y={hoverPos.y} />
      )}
    </div>
  );
}
