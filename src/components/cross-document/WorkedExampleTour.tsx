// ---------------------------------------------------------------------------
// WorkedExampleTour - guided walkthrough of the prepared cross-document
// example, then a collapse-to-one-row control for everyone after.
//
// The example itself stays server-rendered in cross-document.astro, so with
// JavaScript disabled the full example is simply visible and nothing here
// runs. This island enhances it in two ways. On a first visit it walks the
// four sections of the example in reading order, reusing the OnboardingTour
// conventions: [data-tour-anchor] elements, an amber spotlight ring with a
// dim layer, a fixed card with a step counter, Skip, and progress dots, and
// localStorage keys under whetstone.onboarding.*. When the tour ends, or is
// skipped, the example collapses to its header row with a chevron to reopen,
// and that collapsed state persists so a returning visitor sees the single
// row and never the tour again.
//
// The island renders only the chevron and the tour overlay. The example's
// text lives in exactly one place, the .astro markup, and this component
// only toggles its visibility; duplicating the example here would put its
// verbatim-verified quotes at risk of drifting from the audited originals.
//
// Deliberate departures from OnboardingTour, each with its reason:
//   - A Back button. The four steps are a reading order rather than a
//     sequence of actions, and a reader may want to re-read a step.
//   - A step label pinned to the spotlight ring. The highlight must never be
//     carried by the amber colour alone.
//   - scrollIntoView on step change. The example is taller than a phone
//     viewport; the house tour's anchors never were.
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'preact/hooks';
import { track } from '../../lib/analytics/track';

// The completed key follows the OnboardingTour naming scheme. The collapsed
// key is separate because completing the tour and choosing to keep the
// example open are different facts: a visitor who reopens the example should
// find it open next time without the tour restarting.
const TOUR_KEY      = 'whetstone.onboarding.cross-doc-example.completed';
export const COLLAPSED_KEY = 'whetstone.onboarding.cross-doc-example.collapsed';

// Server-rendered elements this island toggles. The body id doubles as the
// aria-controls target of the chevron button.
export const BODY_ID  = 'xdoc-worked-example-body';
const HEADER_SELECTOR = '[data-xdoc-example-header]';

interface Step {
  /** [data-tour-anchor="<id>"] element inside the worked example. */
  anchor: string;
  title:  string;
  body:   string;
}

const STEPS: Step[] = [
  {
    anchor: 'xdoc-question',
    title:  'One shared question',
    body:   'Every cross-document audit starts from the question the documents disagree about. This prepared example compares three published views on nuclear costings for Australia.',
  },
  {
    anchor: 'xdoc-positions',
    title:  'Where each document lands',
    body:   'Each document is audited on its own first, and its position is stated in one line. Note that Doc B declines the whole-pathway comparison the other two are having.',
  },
  {
    anchor: 'xdoc-premise-1',
    title:  'The first contested premise',
    body:   'The briefing leads with disagreement because that is where your judgement is needed: a premise one document depends on, contested by the others in their exact wording.',
  },
  {
    anchor: 'xdoc-premise-2',
    title:  'The second premise, and the quote gate',
    body:   'The closing note is a promise: every passage in quotation marks was checked word-for-word against its source page, and quotes that cannot be verified are dropped, not softened.',
  },
];

// Same guard as OnboardingTour: an anchor must have a real box before it can
// be pointed at, not merely exist in the DOM.
function visibleAnchor(anchorId: string): HTMLElement | null {
  const els = document.querySelectorAll(`[data-tour-anchor="${anchorId}"]`);
  for (const el of Array.from(els)) {
    if (el instanceof HTMLElement) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}

function writeCollapsed(collapsed: boolean): void {
  try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
}

function isTourDone(): boolean {
  // localStorage unavailable means the tour would reappear on every visit,
  // so treat it as done, exactly as OnboardingTour does.
  try { return localStorage.getItem(TOUR_KEY) !== null; } catch { return true; }
}

function markTourDone(): void {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
}

// Show or hide the server-rendered example body. The header keeps its bottom
// border only while the body is open; collapsed, that border would sit
// directly on the section's own border and read as a doubled line.
function applyCollapsed(collapsed: boolean): void {
  const body = document.getElementById(BODY_ID);
  if (body) body.hidden = collapsed;
  const header = document.querySelector(HEADER_SELECTOR);
  if (header instanceof HTMLElement) header.classList.toggle('border-b', !collapsed);
}

export default function WorkedExampleTour() {
  // 'ssr' renders nothing, so the static page is untouched until hydration.
  const [view, setView]       = useState<'ssr' | 'expanded' | 'collapsed'>('ssr');
  const [stepIdx, setStepIdx] = useState<number | null>(null); // null = not touring
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const collapsed = readCollapsed();
    applyCollapsed(collapsed);
    setView(collapsed ? 'collapsed' : 'expanded');
    if (collapsed || isTourDone()) return;
    // Same settle delay as OnboardingTour, so sibling-island hydration and
    // layout finish before anchors are measured.
    const t = setTimeout(() => {
      if (!visibleAnchor(STEPS[0].anchor)) return;
      setStepIdx(0);
      track('onboarding_step', { event: 'started', step: '1' });
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // Re-measure the anchor on step change and whenever the viewport moves,
  // the same strategy as OnboardingTour. Scrolling the anchor into view is
  // the one addition; block: 'nearest' leaves the page alone when the
  // section is already visible.
  useEffect(() => {
    if (stepIdx === null) return;
    const step = STEPS[stepIdx];
    const el = visibleAnchor(step.anchor);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const measure = () => {
      setAnchorRect(visibleAnchor(step.anchor)?.getBoundingClientRect() ?? null);
    };
    measure();
    const t = setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [stepIdx]);

  function collapse(): void {
    applyCollapsed(true);
    writeCollapsed(true);
    setView('collapsed');
  }

  function expand(): void {
    applyCollapsed(false);
    writeCollapsed(false);
    setView('expanded');
  }

  function endTour(outcome: 'completed' | 'skipped'): void {
    markTourDone();
    track('onboarding_step', { event: outcome, step: String((stepIdx ?? 0) + 1) });
    setStepIdx(null);
    collapse();
  }

  function next(): void {
    if (stepIdx === null) return;
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
    else endTour('completed');
  }

  function back(): void {
    if (stepIdx !== null && stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  function toggle(): void {
    // Collapsing mid-tour counts as skipping it; the chevron should never
    // leave a spotlight pointing at a hidden section.
    if (view === 'expanded') {
      if (stepIdx !== null) { endTour('skipped'); return; }
      collapse();
    } else {
      expand();
    }
  }

  if (view === 'ssr') return null;

  const step = stepIdx !== null ? STEPS[stepIdx] : null;
  const haveAnchor = step !== null && anchorRect !== null && anchorRect.width > 0 && anchorRect.height > 0;

  // Card positioning follows OnboardingTour: below the anchor, clamped into
  // the viewport, centered when there is no anchor to point at. The width
  // also clamps to the viewport because this page must work on phones.
  const cardWidth = Math.min(360, (typeof window !== 'undefined' ? window.innerWidth : 360) - 24);
  const cardStyle: Record<string, string> = haveAnchor
    ? {
        position: 'fixed',
        top:      `${Math.min(window.innerHeight - 240, anchorRect.bottom + 12)}px`,
        left:     `${Math.max(12, Math.min(window.innerWidth - cardWidth - 12, anchorRect.left))}px`,
        width:    `${cardWidth}px`,
        zIndex:   '60',
      }
    : {
        position:  'fixed',
        top:       '50%',
        left:      '50%',
        transform: 'translate(-50%, -50%)',
        width:     `${cardWidth}px`,
        zIndex:    '60',
      };

  const expanded = view === 'expanded';

  return (
    <>
      {/* The chevron renders inside the example's header row, which is the
          single row the example collapses to. Direction plus aria-expanded
          carry the state; colour carries nothing. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={BODY_ID}
        aria-label={expanded ? 'Collapse the worked example' : 'Reopen the worked example'}
        class="shrink-0 p-1 -m-1 text-muted hover:text-ink"
      >
        <svg
          class={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        ><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {step && (
        <>
          {/* Soft dim layer so the tour stands out without blocking interaction */}
          <div class="fixed inset-0 z-50 bg-black/20 pointer-events-none" aria-hidden="true" />

          {/* Spotlight around the current section */}
          {haveAnchor && (
            <>
              <div
                class="fixed z-50 rounded-lg ring-4 ring-amber-400 ring-offset-2 pointer-events-none transition-all duration-200"
                style={{
                  top:    `${Math.max(0, anchorRect.top - 4)}px`,
                  left:   `${Math.max(0, anchorRect.left - 4)}px`,
                  width:  `${anchorRect.width + 8}px`,
                  height: `${anchorRect.height + 8}px`,
                }}
              />
              {/* Step label pinned to the ring, so the highlighted section is
                  named in text and never signalled by the amber colour alone. */}
              <div
                class="fixed z-50 pointer-events-none rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-strong shadow-sm"
                style={{
                  top:  `${Math.max(2, anchorRect.top - 28)}px`,
                  left: `${Math.max(2, anchorRect.left - 4)}px`,
                }}
              >
                Step {stepIdx! + 1} of {STEPS.length}
              </div>
            </>
          )}

          {/* Card */}
          <div
            class="rounded-xl bg-surface shadow-2xl border border-hairline p-5"
            style={cardStyle}
            role="dialog"
            aria-labelledby="xdoc-tour-title"
          >
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold uppercase tracking-widest text-amber-600">
                Tour · {stepIdx! + 1} of {STEPS.length}
              </span>
              <button
                type="button"
                onClick={() => endTour('skipped')}
                class="text-xs text-muted hover:text-ink underline underline-offset-2"
              >
                Skip
              </button>
            </div>
            <h3 id="xdoc-tour-title" class="text-base font-semibold text-ink-strong mb-1.5">{step.title}</h3>
            <p class="text-sm text-ink leading-relaxed mb-4">{step.body}</p>
            <div class="flex items-center justify-between">
              <div class="flex gap-1">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    class={`h-1.5 rounded-full transition-all ${
                      i === stepIdx ? 'w-6 bg-amber-500' : 'w-1.5 bg-hairline'
                    }`}
                  />
                ))}
              </div>
              <div class="flex gap-2">
                {stepIdx! > 0 && (
                  <button
                    type="button"
                    onClick={back}
                    class="text-sm font-medium px-3 py-2 rounded-lg border border-hairline text-ink hover:bg-paper transition-colors"
                  >
                    ← Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  class="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  {stepIdx! < STEPS.length - 1 ? 'Next →' : 'Got it'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
