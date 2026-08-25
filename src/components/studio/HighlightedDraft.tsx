import { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import {
  fallacyMatchKey,
  loadedLanguageMatchKey,
  keyTermMatchKey,
  referentMatchKey,
  falsifiabilityMatchKey,
  modalScopeMatchKey,
} from '../../lib/audit';
import type { GroundednessSignal } from '../../../functions/_lib/grounded/types';
import GroundednessChip from '../grounded/GroundednessChip';

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
  flashKey?:        string | null;
  onHighlightClick: (matchKey: string) => void;
}

// ---------------------------------------------------------------------------
// Severity colours
// ---------------------------------------------------------------------------

const SEVERITY_BG: Record<string, string> = {
  high:   'bg-sev-high/20 hover:bg-sev-high/30 border-b-2 border-sev-high',
  medium: 'bg-sev-med/15 hover:bg-sev-med/25 border-b-2 border-sev-med',
  low:    'bg-sev-low/15 hover:bg-sev-low/25 border-b-2 border-sev-low',
};

const SEVERITY_ACTIVE: Record<string, string> = {
  high:   'bg-sev-high/30 ring-2 ring-sev-high',
  medium: 'bg-sev-med/25 ring-2 ring-sev-med',
  low:    'bg-sev-low/25 ring-2 ring-sev-low',
};

// ---------------------------------------------------------------------------
// Extract highlights from audit result
// ---------------------------------------------------------------------------

function extractHighlights(text: string, audit: AuditResult): Highlight[] {
  const highlights: Highlight[] = [];

  // Each finding claims the first occurrence of its quote that no other finding
  // has claimed, so a phrase repeated in the draft maps successive findings to
  // successive copies instead of stacking them all on the first occurrence.
  const used: Array<{ start: number; end: number }> = [];
  function claim(quote: string): number {
    let from = 0;
    for (;;) {
      const idx = text.indexOf(quote, from);
      if (idx === -1) return -1;
      const end = idx + quote.length;
      if (!used.some(r => idx < r.end && end > r.start)) {
        used.push({ start: idx, end });
        return idx;
      }
      from = idx + 1;
    }
  }

  // Named fallacies - have `quote` field
  for (const f of audit.namedFallacies) {
    const idx = claim(f.quote);
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
      matchKey:    fallacyMatchKey(f),
    });
  }

  // Loaded language - have `phrase` field
  for (const l of audit.loadedLanguage) {
    const idx = claim(l.phrase);
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
      matchKey:    loadedLanguageMatchKey(l),
    });
  }

  // Key-term scrutiny - have usage_a and usage_b
  for (const k of audit.keyTermScrutiny) {
    for (const usage of [k.usage_a, k.usage_b]) {
      const idx = claim(usage);
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
        matchKey:    keyTermMatchKey(k),
      });
    }
  }

  // Referent checks - have `evidence` field
  for (const r of audit.referentChecks) {
    const idx = claim(r.evidence);
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
      matchKey:    referentMatchKey(r),
    });
  }

  // Falsifiability checks - have `evidence` field
  for (const f of audit.falsifiabilityChecks) {
    const idx = claim(f.evidence);
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
      matchKey:    falsifiabilityMatchKey(f),
    });
  }

  // Modal scope checks - have `evidence` field
  for (const m of audit.modalScopeChecks) {
    const idx = claim(m.evidence);
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
      matchKey:    modalScopeMatchKey(m),
    });
  }

  // Sort by position, then by severity (high first for overlaps)
  highlights.sort((a, b) => a.start - b.start || (a.severity === 'high' ? -1 : b.severity === 'high' ? 1 : 0));

  return highlights;
}

// ---------------------------------------------------------------------------
// Resolve overlaps - keep highest-severity highlight for overlapping regions
// ---------------------------------------------------------------------------

function resolveOverlaps(highlights: Highlight[]): Highlight[] {
  if (highlights.length === 0) return [];

  const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const resolved: Highlight[] = [highlights[0]!];

  for (let i = 1; i < highlights.length; i++) {
    const current = highlights[i]!;
    const last    = resolved[resolved.length - 1]!;

    if (current.start < last.end) {
      // Overlap - keep the one with higher severity
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

// Fixed width, so the horizontal clamp below is exact rather than a guess.
// (The old card said max-w-sm, 384px, and clamped against 360.)
const CARD_WIDTH = 344;

const SEVERITY_RULE: Record<string, string> = {
  high:   'border-l-sev-high',
  medium: 'border-l-sev-med',
  low:    'border-l-sev-low',
};

const SEVERITY_DOT: Record<string, string> = {
  high:   'bg-sev-high',
  medium: 'bg-sev-med',
  low:    'bg-sev-low',
};

function HoverCard({ highlight, anchor }: { highlight: Highlight; anchor: DOMRect }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Measure, then place. Anchoring to the highlight's own box instead of the
  // mouse point is what stops the card drifting as the pointer moves inside a
  // long quote, and gives a real height to flip against at the foot of the
  // viewport. Runs before paint, so the card is never seen in the wrong spot.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const margin = 8;
    const height = el.offsetHeight;
    const below     = anchor.bottom + margin;
    const above     = anchor.top - height - margin;
    const preferred = below + height + margin > window.innerHeight && above >= margin ? above : below;
    // Last clamp: a card taller than the room on either side of the highlight
    // still has to sit inside the viewport rather than run off it.
    const top  = Math.max(margin, Math.min(preferred, window.innerHeight - height - margin));
    const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - CARD_WIDTH - margin));
    setPos({ top, left });
  }, [anchor, highlight]);

  return (
    <div
      ref={ref}
      role="tooltip"
      class={`fixed z-50 rounded-lg border border-hairline border-l-4 ${SEVERITY_RULE[highlight.severity] ?? 'border-l-hairline'} bg-surface shadow-xl p-3 leading-relaxed pointer-events-none`}
      style={{
        width:      `${CARD_WIDTH}px`,
        left:       `${pos?.left ?? 0}px`,
        top:        `${pos?.top ?? 0}px`,
        // Hidden for the one frame before it has been measured.
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <p class="text-[15px] font-semibold text-ink-strong mb-1">{highlight.label}</p>
      <p class="text-[15px] text-ink">{highlight.explanation}</p>
      <div class="flex items-center gap-2 mt-2 text-[13px]">
        <span class="inline-flex items-center gap-1.5 text-muted">
          <span class={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[highlight.severity] ?? 'bg-muted'}`} />
          {highlight.severity}
        </span>
        {/* Was hardcoded to the word "structural", which labelled every
           interpretive and empirical finding as Logic. Same defect that was
           fixed in HeatmapDraft on 2026-07-13 and missed in this file. */}
        <GroundednessChip groundedness={highlight.groundedness} compact />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HighlightedDraft({ text, audit, activeFindingKey, flashKey, onHighlightClick }: Props) {
  // What is held is the highlight's element rect, not the mouse point.
  const [hovered, setHovered] = useState<{ h: Highlight; anchor: DOMRect } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const leaveTimer   = useRef<number | null>(null);

  const highlights = useMemo(
    () => resolveOverlaps(extractHighlights(text, audit)),
    [text, audit],
  );

  const handleMouseEnter = useCallback((h: Highlight, e: MouseEvent) => {
    // Cancel a pending dismissal: crossing a word of plain text between two
    // highlights used to blank the card and reopen it, which is the flicker.
    if (leaveTimer.current !== null) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setHovered({ h, anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setHovered(null);
      leaveTimer.current = null;
    }, 80);
  }, []);

  // The card is placed in viewport coordinates and measured once, so a scroll
  // or a resize would strand it beside the wrong words. Dismiss, don't chase.
  useEffect(() => {
    if (!hovered) return;
    const dismiss = () => setHovered(null);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [hovered]);

  // Don't leave a dismissal timer running past unmount.
  useEffect(() => () => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
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
    const isFlash  = flashKey === h.matchKey;
    const cls = isActive
      ? SEVERITY_ACTIVE[h.severity] ?? ''
      : SEVERITY_BG[h.severity] ?? '';

    segments.push(
      <mark
        key={`h-${h.start}`}
        class={`cursor-pointer rounded-sm px-0.5 transition-all duration-150 ${cls} ${isFlash ? 'ring-2 ring-accent ring-offset-1' : ''}`}
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
        <div class="flex items-center gap-3 mb-3 text-xs text-muted">
          <span>{highlightCount} finding{highlightCount !== 1 ? 's' : ''} highlighted</span>
          {highCount > 0 && (
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-sev-high" />
              {highCount} high
            </span>
          )}
          {mediumCount > 0 && (
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-sev-med" />
              {mediumCount} medium
            </span>
          )}
          {lowCount > 0 && (
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-sev-low" />
              {lowCount} low
            </span>
          )}
        </div>
      )}

      {/* Draft text with highlights */}
      <div class="rounded-lg border border-hairline bg-surface px-5 py-4 text-sm text-ink leading-relaxed whitespace-pre-wrap font-serif select-text overflow-y-auto" style={{ minHeight: 'calc(100vh - 22rem)' }}>
        {segments}
      </div>

      {/* Hover card */}
      {hovered && (
        <HoverCard highlight={hovered.h} anchor={hovered.anchor} />
      )}
    </div>
  );
}
