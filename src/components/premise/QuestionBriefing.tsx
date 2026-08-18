/**
 * Ask a contested question, get a mini-briefing.
 *
 * This is the mini-briefing engine (functions/_lib/premise/) pointed at a
 * typed question instead of an article. Two staged requests against
 * /api/extension/mini: 'outline' returns in about five seconds with the claims
 * the answer rests on, 'full' follows with sourced quotes that have been
 * checked word-for-word against their pages. The staging exists so the reader
 * has something to read while the expensive half runs.
 *
 * WHERE THIS LIVES. /audit?mode=question, alongside Read and Create, since
 * 2026-08-17. It was first proposed on the cross-document page, but /audit is
 * the single door to the tool, and a question is simply a third way in beside
 * pasting a draft and pasting a URL. The page owns the heading and the
 * explanation of what a run returns, the same way it does for the other two
 * modes; this component owns the field, the disclosure a visitor needs before
 * typing, and the result.
 *
 * The run starts only on an explicit click: a full run does live research and
 * costs real money, so nothing fires on typing or paste. Anonymous visitors
 * get three full runs per browser session (the 2026-08-14 free-tier decision),
 * enforced at the API; this component's job is only to show the sign-in
 * message honestly when the cap answers 401.
 *
 * The finished result renders through MiniBriefingBody, the same component the
 * published reader-question page uses, so what a visitor watched appear live
 * and what anyone later reads at a URL cannot drift apart.
 */
import { useState, useRef, useEffect } from 'preact/hooks';
import type { ClientMiniBriefing, MiniOutline } from '../../../functions/_lib/premise/mini';
import MiniBriefingBody from './MiniBriefingBody';
import { briefingToMarkdown } from './markdown';
import { track } from '../../lib/analytics/track';

type Phase =
  | { status: 'idle' }
  | { status: 'outline' }
  | { status: 'sourcing'; outline: MiniOutline; willResearch: number }
  | { status: 'done'; briefing: ClientMiniBriefing }
  | { status: 'held'; message: string }
  | { status: 'error'; message: string };

const MIN_CHARS = 15;
const MAX_CHARS = 300;

type MiniApiResponse =
  | { ok: true; depth: 'outline'; outline: MiniOutline; willResearch: number }
  | { ok: true; depth: 'full'; briefing: ClientMiniBriefing }
  | { ok: false; error: { code: string; message: string } };

async function callMini(question: string, depth: 'outline' | 'full'): Promise<MiniApiResponse> {
  const res = await fetch('/api/extension/mini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: question, trigger: 'question', depth }),
  });
  return await res.json() as MiniApiResponse;
}

/**
 * The waiting stage: what the engine thinks the question rests on, before any
 * of it has been checked.
 *
 * DELIBERATELY NOT THE PREMISE GRAMMAR. The finished briefing renders premises
 * in bordered bg-paper rows, and that treatment is the page's promise that
 * something survived a source check. Nothing here has. Reading an article and
 * naming its claims is reading; naming the claims under a bare question is
 * recall, which is exactly what the research half exists to test. So this
 * stage gets a plainer treatment and says outright that it is unchecked.
 */
function OutlineRows({ outline, researched }: { outline: MiniOutline; researched: number }) {
  const unresearched = Math.max(0, outline.claims.length - researched);
  // Built as a string rather than inline JSX: interpolating conditional
  // fragments between text nodes lets JSX insert its own whitespace, which put
  // a space in front of a comma the first time this was written.
  const progress =
    `Now researching who contests ${researched === 1 ? 'the first claim' : `the first ${researched} claims`}` +
    (unresearched > 0 ? ', and only those: each claim costs a live search' : '') +
    '. Every quote is checked word-for-word against its source page before it is shown, ' +
    'so this half takes about 40 seconds more.';
  return (
    <div class="space-y-4">
      <p class="font-serif text-lg text-ink-strong leading-snug m-0">{outline.question}</p>
      {outline.conclusion && (
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">What the answer turns on</p>
          <p class="text-sm text-ink m-0 leading-snug">{outline.conclusion}</p>
        </div>
      )}
      <div>
        <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">
          Unchecked so far · the claims the answer rests on
        </p>
        <p class="text-xs text-muted mb-2 m-0 leading-relaxed">
          Nothing below has been checked against a source yet. This is the engine reading the
          question, and it is the part most likely to be wrong.
        </p>
        <div class="space-y-1.5">
          {outline.claims.map((c, i) => (
            <div key={i} class="border-l-2 border-dashed border-hairline pl-3 py-0.5">
              <p class="text-sm text-ink m-0 leading-snug">{c.claim}</p>
              {c.load && <p class="text-xs text-muted mt-0.5 m-0 leading-snug">{c.load}</p>}
            </div>
          ))}
        </div>
      </div>
      <p class="text-xs text-muted m-0 leading-relaxed" role="status">{progress}</p>
    </div>
  );
}

/**
 * A quota is not a fault. Hitting the session cap or the daily cap means the
 * tool worked and there is a limit, so it gets the calm box; only something
 * that actually went wrong gets the red one.
 */
function phaseForError(error: { code: string; message: string }): Phase {
  return error.code === 'SIGNIN_REQUIRED' || error.code === 'RATE_LIMITED'
    ? { status: 'held', message: error.message }
    : { status: 'error', message: error.message };
}

export default function QuestionBriefing() {
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  /**
   * Adopt whatever is already in the field when this island hydrates.
   *
   * The input below is controlled, and this state starts empty, so without
   * this a visitor who starts typing before the JavaScript arrives has their
   * question WIPED the moment it does. The server-rendered field accepts
   * keystrokes immediately; Preact then reconciles it back to the empty
   * string it believes in. On a fast connection the window is a few hundred
   * milliseconds and nobody notices. On a slow one it eats a whole sentence,
   * and the reader has no idea why.
   *
   * Found by an end-to-end test that filled the field faster than any person
   * could, which is exactly what that class of test is for.
   */
  const fieldRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const typedBeforeHydration = fieldRef.current?.value ?? '';
    if (typedBeforeHydration) setQuestion(typedBeforeHydration);
  }, []);

  const trimmed = question.trim();
  const running = phase.status === 'outline' || phase.status === 'sourcing';
  const canRun = !running && trimmed.length >= MIN_CHARS && trimmed.length <= MAX_CHARS;

  async function run() {
    if (!canRun) return;
    setCopied(false);
    setPhase({ status: 'outline' });
    const startedAt = performance.now();
    track('question_briefing_started', { question_chars: trimmed.length });

    try {
      const first = await callMini(trimmed, 'outline');
      if (!first.ok) {
        setPhase(phaseForError(first.error));
        return;
      }
      if (first.depth !== 'outline') {
        setPhase({ status: 'error', message: 'The run came back in the wrong shape. Try again.' });
        return;
      }
      setPhase({ status: 'sourcing', outline: first.outline, willResearch: first.willResearch });

      const second = await callMini(trimmed, 'full');
      if (!second.ok) {
        setPhase(phaseForError(second.error));
        return;
      }
      if (second.depth !== 'full') {
        setPhase({ status: 'error', message: 'The run came back in the wrong shape. Try again.' });
        return;
      }
      setPhase({ status: 'done', briefing: second.briefing });
      track('question_briefing_completed', {
        latency_ms: Math.round(performance.now() - startedAt),
        tier: second.briefing.tier,
        premise_count: second.briefing.premises.length,
      });
    } catch {
      setPhase({ status: 'error', message: 'Network error. Check your connection and try again.' });
    }
  }

  async function copyMarkdown() {
    if (phase.status !== 'done') return;
    const md = briefingToMarkdown(phase.briefing);
    let ok = true;
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      // Clipboard API refused (permissions, older browser): fall back to a
      // transient textarea and the legacy copy command. Its return value is
      // the only signal that the fallback worked, so claiming "Copied"
      // without reading it would be the button lying about the one thing it
      // does.
      const ta = document.createElement('textarea');
      ta.value = md;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      document.body.removeChild(ta);
    }
    if (!ok) {
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 6000);
      return;
    }
    setCopied(true);
    track('question_briefing_copied', {});
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div class="space-y-4">

      {/* Said BEFORE they type, not after they have a result. Every run is
          stored, and a good one may be published at /questions with the
          question in it, so a visitor has to know that while they still get
          to choose what they ask. */}
      <p class="text-xs text-muted m-0 leading-relaxed">
        Every run is kept so we can see where the engine goes wrong, and we may publish a good
        one, question included, on our <a href="/questions" class="text-accent-support hover:underline">reader questions</a> page.
        Nothing publishes automatically. Do not type anything you would not want read.
      </p>

      <form class="space-y-3" onSubmit={(e) => { e.preventDefault(); run(); }}>
        {/* The Reader's field, deliberately: this mode is a third way through
            the same door, so it must not look like a separate tool bolted to
            the side of the page. Same rounded field on bg-surface, same inline
            run control in the corner rather than a CTA of its own. */}
        <div class="relative">
          <input
            ref={fieldRef}
            type="text"
            value={question}
            onInput={(e) => setQuestion((e.target as HTMLInputElement).value)}
            placeholder="Is nuclear cheaper than renewables for Australia?"
            maxLength={MAX_CHARS}
            disabled={running}
            aria-label="Your contested question"
            class="w-full min-h-[56px] rounded-xl border border-hairline bg-surface pl-4 pr-28 py-3 text-base sm:text-sm text-ink placeholder-muted leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
          />
          {/* The label stays short because it sits inside the field. What the
              click actually starts is spelled out in the accessible name and
              in the status line below, which is also where the two stages get
              named once the run is going. */}
          <button
            type="submit"
            disabled={!canRun}
            aria-label="Build the briefing for this question"
            title="Build the briefing for this question"
            class={`absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-lg text-sm font-semibold transition-colors ${
              canRun ? 'bg-accent-support text-paper hover:bg-accent-support/90' : 'bg-hairline/50 text-muted cursor-not-allowed'
            }`}
          >
            {running ? (
              <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                Ask
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* The Reader's hint row: why the button is dead on the left, the
            character budget on the right. Both are words and numbers, so a
            reader who cannot separate two hues loses nothing. */}
        <div class="flex justify-between gap-3 text-xs">
          <span class="text-muted">
            {trimmed.length > 0 && trimmed.length < MIN_CHARS
              ? 'Type the whole question, including what is being compared and where.'
              : 'Free. Three runs per browser session, then sign-in (also free).'}
          </span>
          <span class="text-muted shrink-0">{question.length} / {MAX_CHARS}</span>
        </div>
      </form>

      {phase.status === 'outline' && (
        <p class="text-xs text-muted m-0 leading-relaxed" role="status">
          Reading the question and naming the claims the answer rests on. About five seconds.
        </p>
      )}

      {/* Mid-run and finished results sit on the same raised panel the Reader
          gives its own results, so the page reads as one instrument whichever
          way in was used. */}
      {phase.status === 'sourcing' && (
        <div class="rounded-lg border border-hairline bg-surface p-4">
          <OutlineRows outline={phase.outline} researched={phase.willResearch} />
        </div>
      )}

      {phase.status === 'held' && (
        <div class="rounded-lg border border-hairline bg-paper px-4 py-3">
          <p class="text-sm text-ink m-0 leading-snug">{phase.message}</p>
          <p class="text-xs text-muted mt-1 m-0">
            <a href="/login" class="text-accent-support hover:underline">Sign in</a> takes a minute and stays free.
          </p>
        </div>
      )}

      {phase.status === 'error' && (
        <div class="rounded-xl bg-accent/5 border border-accent/30 p-4">
          <p class="text-sm text-accent m-0">{phase.message}</p>
        </div>
      )}

      {phase.status === 'done' && (
        <div class="rounded-lg border border-hairline bg-surface p-4 space-y-4">
          <MiniBriefingBody briefing={phase.briefing} />
          <div class="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
            <p class="text-xs text-muted m-0">
              {copyFailed
                ? 'This browser blocked the copy. Select the briefing above and copy it by hand.'
                : 'This result is not saved to an account. Copy it before you leave.'}
            </p>
            <button
              type="button"
              onClick={copyMarkdown}
              class="ml-auto py-2 px-5 rounded-lg text-sm font-semibold border border-hairline text-ink hover:bg-paper transition-colors"
            >
              {copied ? 'Copied' : 'Copy as markdown'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
