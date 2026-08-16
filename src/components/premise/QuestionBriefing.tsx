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
 * The run starts only on an explicit click: a full run does live research and
 * costs real money, so nothing fires on typing or paste. Anonymous visitors
 * get three full runs per browser session (the 2026-08-14 free-tier decision),
 * enforced at the API; this component's job is only to show the sign-in
 * message honestly when the cap answers 401.
 *
 * The rendering deliberately reuses the row grammar of the worked example on
 * the cross-document page: mono uppercase kickers, bg-paper rows, stance named
 * in words before any colour, quotes behind a left rule. Meaning never rides
 * on colour alone.
 */
import { useState } from 'preact/hooks';
import type { MiniBriefing, MiniOutline, MiniSource, Stance } from '../../../functions/_lib/premise/mini';
import { track } from '../../lib/analytics/track';

type Phase =
  | { status: 'idle' }
  | { status: 'outline' }
  | { status: 'sourcing'; outline: MiniOutline }
  | { status: 'done'; briefing: MiniBriefing }
  | { status: 'signin'; message: string }
  | { status: 'error'; message: string };

const MIN_CHARS = 15;
const MAX_CHARS = 300;

/** The stance in words, always. The colour is a second channel, never the only one. */
const STANCE_LABEL: Record<Stance, string> = {
  contests: 'Contests',
  complicates: 'Complicates',
  supports: 'Supports',
};
const STANCE_CLASS: Record<Stance, string> = {
  contests: 'text-spec-right',
  complicates: 'text-muted',
  supports: 'text-spec-left',
};

function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

type MiniApiResponse =
  | { ok: true; depth: 'outline'; outline: MiniOutline }
  | { ok: true; depth: 'full'; briefing: MiniBriefing }
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
 * The briefing as markdown, for pasting anywhere.
 *
 * House copy rules hold in the export too: no em dashes, stances written as
 * words, and the verification promise stated plainly at the end. The quotes
 * are reproduced exactly as verified; everything else is labelled as ours.
 */
export function briefingToMarkdown(b: MiniBriefing): string {
  const lines: string[] = [];
  lines.push(`# ${b.question || 'Mini-briefing'}`);
  lines.push('');
  if (b.conclusion) {
    lines.push(`What the answer turns on: ${b.conclusion}`);
    lines.push('');
  }

  b.premises.forEach((p, i) => {
    lines.push(`## Premise ${i + 1}: ${p.claim}`);
    lines.push('');
    if (p.load) {
      lines.push(`Why it carries weight: ${p.load}`);
      lines.push('');
    }
    for (const s of p.sources) {
      lines.push(sourceLine(s));
      lines.push('');
    }
    if (p.undisputed) {
      lines.push('No published objection was found for this claim. That is not agreement; it may only mean nobody has written the objection down where this run could reach.');
      lines.push('');
    }
  });

  if (b.opposing.length > 0) {
    lines.push('## Published disagreement');
    lines.push('');
    for (const s of b.opposing) {
      lines.push(sourceLine(s));
      lines.push('');
    }
  }

  if (b.limits.length > 0) {
    lines.push('## What this cannot promise');
    lines.push('');
    for (const l of b.limits) lines.push(`- ${l}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('Built with The Whetstone (https://thewhetstone.review/creator/studio/cross-document). Every quote above was checked word-for-word against its source page before it was shown; quotes that failed the check were dropped, not softened.');
  return lines.join('\n');
}

function sourceLine(s: MiniSource): string {
  const stance = STANCE_LABEL[s.stance ?? 'supports'];
  const who = [s.who, s.publication].filter(Boolean).join(', ');
  const url = s.resolvedUrl ?? s.url;
  const quote = s.quote ? `"${s.quote}"` : s.position;
  return `- ${stance}. ${who}: ${quote}${url ? ` (${url})` : ''}`;
}

/** One verified source, in the worked example's row grammar. */
function SourceRow({ s }: { s: MiniSource }) {
  const stance = s.stance ?? 'supports';
  const url = s.resolvedUrl ?? s.url;
  const host = hostOf(url);
  return (
    <div>
      <p class={`font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${STANCE_CLASS[stance]} m-0`}>
        {STANCE_LABEL[stance]} · {s.who}{s.publication && s.publication !== s.who ? ` · ${s.publication}` : ''}
      </p>
      <p class="text-xs text-ink border-l-2 border-hairline pl-2 m-0 leading-snug">
        {s.quote ? <>&ldquo;{s.quote}&rdquo;</> : s.position}
        {url && host && (
          <>
            {' '}
            <a href={url} target="_blank" rel="noopener noreferrer" class="text-accent-support hover:underline">({host})</a>
          </>
        )}
      </p>
    </div>
  );
}

/** The outline rows: shown alone while sourcing runs, then inside the result. */
function OutlineRows({ outline, researching }: { outline: MiniOutline; researching: boolean }) {
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
        <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">The claims the answer rests on</p>
        <div class="space-y-1.5">
          {outline.claims.map((c, i) => (
            <div key={i} class="rounded border border-hairline bg-paper px-3 py-2">
              <p class="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted m-0">Claim {i + 1}</p>
              <p class="text-sm text-ink m-0 leading-snug">{c.claim}</p>
              {c.load && <p class="text-xs text-muted mt-1 m-0 leading-snug">{c.load}</p>}
            </div>
          ))}
        </div>
      </div>
      {researching && (
        <p class="text-xs text-muted m-0 leading-relaxed" role="status">
          Now researching who contests each claim. Every quote is checked word-for-word against
          its source page before it is shown, so this half takes about 30 seconds more.
        </p>
      )}
    </div>
  );
}

function BriefingResult({ briefing }: { briefing: MiniBriefing }) {
  return (
    <div class="space-y-4">
      <p class="font-serif text-lg text-ink-strong leading-snug m-0">{briefing.question}</p>
      {briefing.conclusion && (
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">What the answer turns on</p>
          <p class="text-sm text-ink m-0 leading-snug">{briefing.conclusion}</p>
        </div>
      )}

      {briefing.premises.length > 0 && (
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">The premises the answer rests on</p>
          <div class="space-y-1.5">
            {briefing.premises.map((p, i) => (
              <div key={i} class="rounded border border-hairline bg-paper px-3 py-2.5">
                <p class="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted m-0">Premise {i + 1}</p>
                <p class="text-sm text-ink m-0 leading-snug">{p.claim}</p>
                {p.load && <p class="text-xs text-muted mt-1 mb-2 leading-snug">{p.load}</p>}
                {p.sources.length > 0 && (
                  <div class="border-t border-dashed border-hairline pt-2 space-y-2">
                    {p.sources.map((s, j) => <SourceRow key={j} s={s} />)}
                  </div>
                )}
                {p.undisputed && (
                  <p class="text-xs text-muted mt-2 m-0 leading-snug">
                    No published objection was found for this claim. That is not agreement with it.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing.opposing.length > 0 && (
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">Published disagreement</p>
          <div class="rounded border border-hairline bg-paper px-3 py-2.5 space-y-2">
            {briefing.opposing.map((s, j) => <SourceRow key={j} s={s} />)}
          </div>
        </div>
      )}

      {briefing.limits.length > 0 && (
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">What this cannot promise</p>
          <ul class="list-none p-0 m-0 space-y-1">
            {briefing.limits.map((l, i) => (
              <li key={i} class="text-xs text-muted leading-relaxed">{l}</li>
            ))}
          </ul>
        </div>
      )}

      <p class="text-xs text-muted m-0 leading-relaxed">
        Everything in quotation marks above was checked word-for-word against its source page
        during this run; the rest is reported in our words. Quotes that could not be verified
        were dropped, not softened.
      </p>
    </div>
  );
}

export default function QuestionBriefing() {
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

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
        setPhase(first.error.code === 'SIGNIN_REQUIRED'
          ? { status: 'signin', message: first.error.message }
          : { status: 'error', message: first.error.message });
        return;
      }
      if (first.depth !== 'outline') {
        setPhase({ status: 'error', message: 'The run came back in the wrong shape. Try again.' });
        return;
      }
      setPhase({ status: 'sourcing', outline: first.outline });

      const second = await callMini(trimmed, 'full');
      if (!second.ok) {
        setPhase(second.error.code === 'SIGNIN_REQUIRED'
          ? { status: 'signin', message: second.error.message }
          : { status: 'error', message: second.error.message });
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
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      // Clipboard API refused (permissions, older browser): fall back to a
      // transient textarea and the legacy copy command.
      const ta = document.createElement('textarea');
      ta.value = md;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    track('question_briefing_copied', {});
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <section class="rounded-lg border border-hairline bg-surface overflow-hidden">
      <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-hairline">
        <p class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted m-0">
          Ask your own question
        </p>
        <p class="font-mono text-[11px] text-muted m-0">live, about 40 seconds</p>
      </div>

      <div class="p-4 space-y-4">
        <p class="text-sm text-muted m-0 leading-relaxed">
          Type a contested question. The engine names the claims the answer rests on, then
          researches who contests each one, quoting only what it can verify word-for-word at
          the source.
        </p>

        <form
          class="space-y-2"
          onSubmit={(e) => { e.preventDefault(); run(); }}
        >
          <input
            type="text"
            value={question}
            onInput={(e) => setQuestion((e.target as HTMLInputElement).value)}
            placeholder="Is nuclear cheaper than renewables for Australia?"
            maxLength={MAX_CHARS}
            disabled={running}
            aria-label="Your contested question"
            class="w-full rounded-md border border-hairline px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div class="flex flex-wrap items-center gap-3">
            <p class="text-xs text-muted m-0">
              Free. Three runs per browser session, then sign-in (also free).
            </p>
            <button
              type="submit"
              disabled={!canRun}
              class={`ml-auto py-2 px-5 rounded-xl text-sm font-semibold transition-colors ${
                canRun ? 'bg-accent-support text-white hover:bg-accent-support/90' : 'bg-hairline/40 text-muted cursor-not-allowed'
              }`}
            >
              {phase.status === 'outline' ? 'Reading the question…'
                : phase.status === 'sourcing' ? 'Sourcing quotes…'
                : 'Build the briefing'}
            </button>
          </div>
        </form>

        {phase.status === 'outline' && (
          <p class="text-xs text-muted m-0 leading-relaxed" role="status">
            Naming the claims the answer rests on. About five seconds.
          </p>
        )}

        {phase.status === 'sourcing' && <OutlineRows outline={phase.outline} researching={true} />}

        {phase.status === 'signin' && (
          <div class="rounded border border-hairline bg-paper px-3 py-2.5">
            <p class="text-sm text-ink m-0 leading-snug">{phase.message}</p>
            <p class="text-xs text-muted mt-1 m-0">
              <a href="/login" class="text-accent-support hover:underline">Sign in</a> takes a minute and stays free.
            </p>
          </div>
        )}

        {phase.status === 'error' && (
          <div class="rounded-xl bg-red-50 border border-red-200 p-4">
            <p class="text-sm text-red-700 m-0">{phase.message}</p>
          </div>
        )}

        {phase.status === 'done' && (
          <div class="border-t border-hairline pt-4 space-y-4">
            <BriefingResult briefing={phase.briefing} />
            <div class="flex flex-wrap items-center gap-3">
              <p class="text-xs text-muted m-0">
                This result is not saved to an account. Copy it before you leave.
              </p>
              <button
                type="button"
                onClick={copyMarkdown}
                class="ml-auto py-2 px-5 rounded-xl text-sm font-semibold border border-hairline text-ink hover:bg-paper transition-colors"
              >
                {copied ? 'Copied' : 'Copy as markdown'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
