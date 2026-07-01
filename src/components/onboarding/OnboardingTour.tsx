// ---------------------------------------------------------------------------
// OnboardingTour - 5-step floating walkthrough for first-time Studio users.
//
// Behaviour:
//   - Shows automatically on first /creator/studio visit (localStorage-gated)
//   - Dismissable at any step; never reappears once user clicks "Got it"
//   - Skip button on every step
//   - No external dependencies; pure Preact + CSS
//
// Anchoring strategy: each step references a [data-tour-anchor="..."] element
// in the DOM. If the anchor isn't found, the step falls back to a centered
// modal (so the tour doesn't break if the UI changes).
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from 'preact/hooks';
import { track } from '../../lib/analytics/track';

const TOUR_VERSION    = 'studio-v1';
const STORAGE_KEY     = `whetstone.onboarding.${TOUR_VERSION}.completed`;

interface Step {
  /** [data-tour-anchor="<id>"] selector; if missing, centered fallback. */
  anchor:  string;
  title:   string;
  body:    string;
}

const STEPS: Step[] = [
  {
    anchor: 'studio-textarea',
    title:  'Paste your draft here',
    body:   'Any argumentative text - an essay, op-ed, Substack post. 50-10,000 characters. The engine reads the structure, not the surface.',
  },
  {
    anchor: 'studio-analyse',
    title:  'Click Analyse',
    body:   'Takes 15-30 seconds. The engine maps the argument with the Toulmin framework, surfaces 26 named fallacy patterns, finds loaded language, and identifies unstated warrants.',
  },
  {
    anchor: 'studio-findings',
    title:  'Read the findings',
    body:   'Each finding cites the exact passage. Click to jump to it in the text. Accept, dismiss, or mark as addressed - your responses persist with the document.',
  },
  {
    anchor: 'studio-deeper-lenses',
    title:  'Run a deeper lens',
    body:   'On demand: presuppositions (what the argument assumes without arguing), rhetorical mode (ethos/pathos/logos balance), engagement quality (steelman vs strawman of opposition), structural incentive (whose positions the framing serves). All free.',
  },
  {
    anchor: 'studio-share',
    title:  'Share or save',
    body:   "Share the audit as a permalink - the link includes the source text and findings. Save documents for later; versions are tracked automatically.",
  },
];

export default function OnboardingTour() {
  const [stepIdx, setStepIdx] = useState(0);
  const [dismissed, setDismissed] = useState(true); // start hidden, enable after mount
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        setDismissed(false);
        track('onboarding_step', { event: 'started', step: '1' });
      }
    } catch { /* localStorage unavailable; never show */ }
  }, []);

  // Re-measure anchor every step change + on window resize.
  useEffect(() => {
    if (dismissed) return;
    const step = STEPS[stepIdx];
    if (!step) return;
    const measure = () => {
      const el = document.querySelector(`[data-tour-anchor="${step.anchor}"]`);
      setAnchorRect(el instanceof HTMLElement ? el.getBoundingClientRect() : null);
    };
    measure();
    // Recompute when layout settles (sticky elements, etc.)
    const t = setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [stepIdx, dismissed]);

  function complete() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
    track('onboarding_step', { event: 'completed', step: String(stepIdx + 1) });
  }

  function skip() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
    track('onboarding_step', { event: 'skipped', step: String(stepIdx + 1) });
  }

  function next() {
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      complete();
    }
  }

  if (dismissed) return null;
  const step = STEPS[stepIdx];
  if (!step) return null;

  // Card positioning: try below the anchor; if there's no anchor or it's off-screen,
  // center on viewport.
  const haveAnchor = anchorRect && anchorRect.width > 0 && anchorRect.height > 0;
  const cardStyle: Record<string, string> = haveAnchor
    ? {
        position: 'fixed',
        top:      `${Math.min(window.innerHeight - 240, anchorRect.bottom + 12)}px`,
        left:     `${Math.max(12, Math.min(window.innerWidth - 380, anchorRect.left))}px`,
        width:    '360px',
        zIndex:   '60',
      }
    : {
        position: 'fixed',
        top:      '50%',
        left:     '50%',
        transform: 'translate(-50%, -50%)',
        width:    '360px',
        zIndex:   '60',
      };

  return (
    <>
      {/* Soft dim layer so the tour stands out without blocking interaction */}
      <div
        class="fixed inset-0 z-50 bg-black/20 pointer-events-none"
        aria-hidden="true"
      />

      {/* Optional spotlight around the anchor */}
      {haveAnchor && (
        <div
          class="fixed z-50 rounded-lg ring-4 ring-amber-400 ring-offset-2 pointer-events-none transition-all duration-200"
          style={{
            top:    `${Math.max(0, anchorRect.top - 4)}px`,
            left:   `${Math.max(0, anchorRect.left - 4)}px`,
            width:  `${anchorRect.width + 8}px`,
            height: `${anchorRect.height + 8}px`,
          }}
        />
      )}

      {/* Card */}
      <div
        class="rounded-xl bg-surface shadow-2xl border border-hairline p-5"
        style={cardStyle}
        role="dialog"
        aria-labelledby="tour-title"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold uppercase tracking-widest text-amber-600">
            Tour · {stepIdx + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            onClick={skip}
            class="text-xs text-muted hover:text-ink underline underline-offset-2"
          >
            Skip
          </button>
        </div>
        <h3 id="tour-title" class="text-base font-semibold text-ink-strong mb-1.5">{step.title}</h3>
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
          <button
            type="button"
            onClick={next}
            class="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            {stepIdx < STEPS.length - 1 ? 'Next →' : 'Got it'}
          </button>
        </div>
      </div>
    </>
  );
}
