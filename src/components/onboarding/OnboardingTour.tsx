// ---------------------------------------------------------------------------
// OnboardingTour - two-act floating walkthrough for first-time Studio users.
//
// Act 1 (pre-analysis) walks the anchors that exist on a fresh editor, the
// textarea and the Analyse button, and closes on a card telling the user the
// remaining tips arrive after the first analysis.
//
// Act 2 (post-analysis) fires once, on the first landing of the audit state
// in 'done' (StudioEditor dispatches STUDIO_ANALYSIS_DONE_EVENT from a
// useEffect watching that state), and walks the now-real result elements:
// findings list, deeper lenses, share/summary toolbar. Any anchor missing or
// invisible at fire time is skipped rather than pointed at.
//
// Each act completes against its own localStorage key, so finishing the
// pre-analysis act can no longer permanently swallow the post-analysis tips
// (the failure mode of the single-key v1 tour, which walked anchors that did
// not exist yet and then marked the whole tour complete).
//
// Anchoring strategy: each step references a [data-tour-anchor="..."] element
// in the DOM. A step with a null anchor renders as a centered modal.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef } from 'preact/hooks';
import { track } from '../../lib/analytics/track';
import { STUDIO_ANALYSIS_DONE_EVENT } from '../studio/analysis-events';

// v1 used one key for the whole tour and marked it complete before the
// post-analysis anchors ever existed. Anyone who finished v1 has seen Act 1's
// content, so the legacy key still counts as Act 1 completion; Act 2 is new
// to everyone.
const LEGACY_V1_KEY = 'whetstone.onboarding.studio-v1.completed';
const ACT1_KEY      = 'whetstone.onboarding.studio-v2-act1.completed';
const ACT2_KEY      = 'whetstone.onboarding.studio-v2-act2.completed';

type Act = 'act1' | 'act2';

interface Step {
  /** [data-tour-anchor="<id>"] selector; null renders a centered card. */
  anchor:  string | null;
  title:   string;
  body:    string;
}

const ACT1_STEPS: Step[] = [
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
    anchor: null,
    title:  'The next tips appear after your first analysis',
    body:   'Once the results are in, the tour picks up where it left off: reading the findings, running deeper lenses, and sharing the audit.',
  },
];

const ACT2_STEPS: Step[] = [
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

// The result rails are display:none below the desktop breakpoint (their
// content lives in the mobile bottom sheet), so "exists in the DOM" is not
// enough: an anchor must have a real box to be pointed at.
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

function isActDone(key: string): boolean {
  try { return localStorage.getItem(key) !== null; } catch { return true; /* localStorage unavailable: never show */ }
}

function markActDone(key: string): void {
  try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
}

export default function OnboardingTour() {
  const [act, setAct]         = useState<Act | null>(null); // null = hidden
  const [steps, setSteps]     = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // The analysis-done listener subscribes once but must run the LATEST start
  // logic (same ref-assigned-every-render pattern as handleAnalyseRef in
  // StudioEditor, which this codebase uses against stale closures).
  const startAct2Ref = useRef<() => void>(() => {});

  function startAct2() {
    if (act === 'act2' || isActDone(ACT2_KEY)) return;
    // Skip any step whose anchor is missing or invisible rather than pointing
    // at nothing. If none are visible (e.g. below the desktop breakpoint the
    // result rails are hidden), leave the key unset so a later analysis with
    // visible anchors can still fire the act.
    const available = ACT2_STEPS.filter(s => s.anchor !== null && visibleAnchor(s.anchor) !== null);
    if (available.length === 0) return;
    // Act 1's anchors just left the page (the textarea becomes the highlighted
    // view), so if it was mid-run, close it out rather than strand it.
    if (act === 'act1') markActDone(ACT1_KEY);
    setSteps(available);
    setStepIdx(0);
    setAct('act2');
    track('onboarding_step', { event: 'started', step: '1', act: 'act2' });
  }
  startAct2Ref.current = startAct2;

  useEffect(() => {
    // Delay the mount check so sibling-island hydration and layout settle
    // before anchors are queried.
    const t = setTimeout(() => {
      if (!isActDone(ACT2_KEY) && visibleAnchor('studio-findings')) {
        // Results already on screen: a reopened audited document, or the done
        // event fired before this island subscribed. Go straight to Act 2.
        startAct2Ref.current();
        return;
      }
      if (isActDone(ACT1_KEY) || isActDone(LEGACY_V1_KEY)) return;
      if (!visibleAnchor('studio-textarea')) return; // not a fresh editor
      setSteps(ACT1_STEPS);
      setStepIdx(0);
      setAct('act1');
      track('onboarding_step', { event: 'started', step: '1', act: 'act1' });
    }, 400);

    const onAnalysisDone = () => startAct2Ref.current();
    window.addEventListener(STUDIO_ANALYSIS_DONE_EVENT, onAnalysisDone);
    return () => {
      clearTimeout(t);
      window.removeEventListener(STUDIO_ANALYSIS_DONE_EVENT, onAnalysisDone);
    };
  }, []);

  // Re-measure anchor every step change + on window resize.
  useEffect(() => {
    if (!act) return;
    const step = steps[stepIdx];
    if (!step) return;
    const measure = () => {
      setAnchorRect(step.anchor ? (visibleAnchor(step.anchor)?.getBoundingClientRect() ?? null) : null);
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
  }, [stepIdx, act, steps]);

  function complete() {
    if (act) markActDone(act === 'act1' ? ACT1_KEY : ACT2_KEY);
    setAct(null);
    track('onboarding_step', { event: 'completed', step: String(stepIdx + 1), act: act ?? 'unknown' });
  }

  function skip() {
    if (act) markActDone(act === 'act1' ? ACT1_KEY : ACT2_KEY);
    setAct(null);
    track('onboarding_step', { event: 'skipped', step: String(stepIdx + 1), act: act ?? 'unknown' });
  }

  function next() {
    if (stepIdx < steps.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      complete();
    }
  }

  if (!act) return null;
  const step = steps[stepIdx];
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
            Tour · {stepIdx + 1} of {steps.length}
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
            {steps.map((_, i) => (
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
            {stepIdx < steps.length - 1 ? 'Next →' : 'Got it'}
          </button>
        </div>
      </div>
    </>
  );
}
