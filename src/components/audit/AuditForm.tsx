import { useState, useEffect, useRef } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import { totalFindingCount, auditVerdict, lensesChecked } from '../../lib/audit';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import AuditResults from './AuditResults';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import ToulminCallouts from './ToulminCallouts';
import HighlightedDraft from '../studio/HighlightedDraft';
import DeeperLensPanel from '../lens-panel/DeeperLensPanel';
import ReaderOpposingCase from '../counterargument/ReaderOpposingCase';
import { applyContextualSeverity } from '../../../functions/_lib/audit/contextual-severity';
import { track } from '../../lib/analytics/track';
import { SAMPLES, type Sample } from '../../data/samples';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditApiResponse =
  | { ok: true;  audit: AuditResult; sourceText?: string; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type ExtractionApiResponse =
  | { ok: true;  extraction: ArgumentExtractionResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CHARS = 50;
const MAX_CHARS = 10_000;

// First-time-visitor examples now come from the shared Studio sample set
// (src/data/samples) — pre-cached audits, loaded instantly with no API call.

const ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:      "You've reached the daily audit limit. Come back tomorrow to run more audits.",
  EXTRACTION_FAILED: "Couldn't extract the article text from that URL. Try pasting the text directly instead.",
  TOO_SHORT:         'The extracted text was too short to audit. Try pasting the full article text directly.',
  NOT_HTML:          "That URL doesn't point to an HTML page. Try pasting the text directly instead.",
  FETCH_FAILED:      "Couldn't reach that URL - check it's publicly accessible, or paste the text directly.",
  AUDIT_FAILED:      'The analysis failed. Please try again in a moment.',
  INVALID_INPUT:     'Please check your input and try again.',
};

// A single pasted token starting with http(s) and containing no whitespace is
// treated as a URL to fetch; anything else is treated as argument text.
const URL_RE = /^https?:\/\/\S+$/i;

// Count span-level findings for the results verdict bar. The Reader has no
// dismissed state (no document), so the raw arrays are the active set.
function countFindings(r: AuditResult) {
  const groups: { severity: string }[][] = [
    r.namedFallacies as { severity: string }[],
    r.loadedLanguage as { severity: string }[],
    (r.keyTermScrutiny ?? []) as { severity: string }[],
    (r.referentChecks ?? []) as { severity: string }[],
    (r.falsifiabilityChecks ?? []) as { severity: string }[],
    (r.modalScopeChecks ?? []) as { severity: string }[],
  ];
  let total = 0, critical = 0;
  for (const g of groups) for (const f of g) { total++; if (f.severity === 'high') critical++; }
  return { total, critical };
}

// ---------------------------------------------------------------------------
// Loading state — a progress bar (eased fast-then-slow toward ~90%, never
// completing until the result lands) plus a skeleton of the result layout.
// Research: for 10s+ waits a bar + skeleton beats a spinner — it reduces
// perceived wait and signals the structure that's coming.
// ---------------------------------------------------------------------------

function AuditLoading() {
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AuditForm({ isPro = false, initialText = '', initialUrl = '', initialSampleId = '' }: { isPro?: boolean; initialText?: string; initialUrl?: string; initialSampleId?: string }) {
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<AuditResult | null>(null);
  const [extraction, setExtraction] = useState<ArgumentExtractionResult | null>(null);
  const [loadedFromLink, setLoadedFromLink] = useState(false);
  // The text the audit ran against — drives the deeper-lens panel and the
  // highlighted draft. For text audits it's the pasted text; for URL audits it's
  // the server-extracted article body.
  const [sourceText, setSourceText] = useState<string>('');
  // Which mode the *last completed* audit ran in — decides whether the left
  // highlighted-draft panel appears. Not derived from `input`, which can change
  // after results render.
  const [auditedMode, setAuditedMode] = useState<'text' | 'url' | null>(null);
  // After a successful audit the input collapses to a summary bar; "Edit" flips
  // this back to the full field.
  const [editing, setEditing] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [showExamples, setShowExamples] = useState(false);

  // /?audit=<slug> or /?url=<src> deep-link from a briefing: pre-load the field
  // and bring it into view. We deliberately don't auto-run — the reader presses
  // the button — so a crawler or accidental prefetch can't burn audit quota.
  useEffect(() => {
    // Home-feed launcher example chip → /audit?sample=<id>: load the pre-cached
    // sample immediately (worked result, no API call). Takes precedence over the
    // text/URL prefills, which are mutually exclusive with it in practice.
    if (initialSampleId) {
      const s = SAMPLES.find((x) => x.id === initialSampleId);
      if (s) { loadSample(s); return; }
    }
    if (initialUrl && initialUrl.startsWith('http')) {
      setInput(initialUrl);
      setLoadedFromLink(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (initialText && initialText.length >= MIN_CHARS) {
      setInput(initialText);
      setLoadedFromLink(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Homepage compact launcher hand-off (D1-B): the launcher stashes the
      // pasted value and navigates here; consume it once.
      try {
        const h = sessionStorage.getItem('wst_handoff');
        if (h) {
          sessionStorage.removeItem('wst_handoff');
          setInput(h);
        }
      } catch { /* storage unavailable */ }
    }
  }, []);

  const trimmed   = input.trim();
  const looksUrl  = URL_RE.test(trimmed);
  const charCount = input.length;
  const textValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const canSubmit = !loading && (looksUrl || textValid);
  // The left panel is the highlighted draft (text audits only). The skeleton +
  // Toulmin now live together in the right-column "Argument structure" region,
  // so a URL audit (no draft) collapses findings + structure to full width.
  const hasLeftContent = auditedMode === 'text' && !!sourceText;
  // A4 experimental flag (off by default) — `?ctxsev=1` re-bands severities by
  // argument context for A/B evaluation. Never on in production.
  const ctxSev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ctxsev') === '1';
  // The result actually shown (ctxsev re-bands severities when the flag is on).
  const displayResult = result ? (ctxSev && extraction ? applyContextualSeverity(result, extraction) : result) : null;
  const counts = result ? countFindings(result) : { total: 0, critical: 0 };
  const auditedWords = sourceText ? sourceText.trim().split(/\s+/).filter(Boolean).length : 0;

  // Jump-tab teleport within the single results scroll. Opens the target fold
  // (or the fold that contains the target) before scrolling to it.
  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const det = el.closest('details') as HTMLDetailsElement | null;
    if (det) det.open = true;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  // Reset to the pre-audit state (from the collapsed input bar's "New audit").
  function newAudit() {
    setInput('');
    setResult(null);
    setExtraction(null);
    setError(null);
    setAuditedMode(null);
    setSourceText('');
    setEditing(false);
  }

  // Core audit runner, shared by the form submit and the example chips.
  async function runAudit(raw: string) {
    const t      = raw.trim();
    const isUrl  = URL_RE.test(t);
    const isText = !isUrl;
    // Guard: text needs to clear the length bounds; URLs always pass.
    if (isText && !(raw.length >= MIN_CHARS && raw.length <= MAX_CHARS)) return;

    setLoading(true);
    setEditing(false);
    setError(null);
    setResult(null);
    setExtraction(null);

    const body      = isText ? { text: raw } : { url: t };
    const startedAt = performance.now();
    track('audit_started', { surface: 'reader', source_kind: isText ? 'text' : 'url' });

    try {
      const requests: Promise<unknown>[] = [
        fetch('/api/audit', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        }).then(r => r.json() as Promise<AuditApiResponse>),
      ];

      if (isText) {
        requests.push(
          fetch('/api/extract-argument', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ text: raw }),
          }).then(r => r.json() as Promise<ExtractionApiResponse>),
        );
      }

      const [auditData, extractionData] = await Promise.allSettled(requests);

      // Handle audit result
      if (auditData.status === 'fulfilled') {
        const data = auditData.value as AuditApiResponse;
        if (data.ok) {
          setResult(data.audit);
          setSourceText(data.sourceText ?? (isText ? raw : ''));
          setAuditedMode(isText ? 'text' : 'url');
          track('audit_completed', {
            latency_ms:    Math.round(performance.now() - startedAt),
            finding_count: totalFindingCount(data.audit),
            has_phase_two: false,
          });
        } else {
          const code = data.error.code;
          setError(ERROR_MESSAGES[code] ?? data.error.message ?? 'Something went wrong.');
          track('audit_failed', { error_code: code });
        }
      } else {
        setError('Network error - check your connection and try again.');
        track('audit_failed', { error_code: 'NETWORK' });
      }

      // Handle extraction result (best-effort — don't block audit display on failure)
      if (extractionData && extractionData.status === 'fulfilled') {
        const data = extractionData.value as ExtractionApiResponse;
        if (data.ok) setExtraction(data.extraction);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    runAudit(input);
  }

  // Example picker: load a PRE-CACHED sample (no API call). We keep a short
  // artificial delay + the same loading animation so it doesn't feel fake — the
  // reader still sees the "reading and analysing" beat, then the result lands.
  function loadSample(sample: Sample) {
    setShowExamples(false);
    setError(null);
    setEditing(false);
    setResult(null);
    setExtraction(null);
    setInput(sample.text);
    setSourceText(sample.text);
    setAuditedMode('text');
    setLoading(true);
    track('sample_picked', { sample_id: sample.id });
    window.setTimeout(() => {
      setResult(sample.cached.audit as AuditResult);
      setExtraction(sample.cached.extraction as ArgumentExtractionResult);
      setLoading(false);
    }, 1200);
  }

  return (
    <div class="space-y-5" ref={formRef}>

      {loadedFromLink && (
        <div class="rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
          <p class="text-xs text-accent">
            Loaded from a briefing. Press the <span class="font-semibold">audit</span> button to run the full structural audit on it.
          </p>
        </div>
      )}

      {/* Input: full field before an audit (or when editing), a compact summary
          bar after — so the pasted text isn't duplicated with the marked draft. */}
      {(result && !editing) ? (
        <div class="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-2.5">
          <span class="text-sm text-ink">Audited <span class="font-medium">{auditedWords.toLocaleString()} words</span></span>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} class="text-xs px-3 py-1 rounded-md border border-hairline text-ink hover:border-accent hover:text-accent transition-colors">Edit</button>
            <button type="button" onClick={newAudit} class="text-xs px-3 py-1 rounded-md bg-accent text-paper hover:bg-accent/90 transition-colors">New audit</button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} class="space-y-3">
        {/* Unified input — auto-detects a pasted URL vs argument text. The run
            control is an inline arrow inside the field (no separate CTA, no tabs). */}
        <div class="relative">
          <textarea
            value={input}
            onInput={e => setInput((e.target as HTMLTextAreaElement).value)}
            placeholder="Paste an argument, or drop a link to audit…"
            aria-label="Argument text or URL to audit"
            rows={loadedFromLink ? 6 : 2}
            class="w-full rounded-xl border border-hairline bg-surface pl-4 pr-16 py-3 text-sm text-ink placeholder-muted leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
            style={`min-height:${loadedFromLink ? 180 : 64}px;`}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Audit this argument"
            title="Audit this argument"
            class={`absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              canSubmit ? 'bg-accent text-paper hover:bg-accent/90' : 'bg-hairline/50 text-muted cursor-not-allowed'
            }`}
          >
            {loading ? (
              <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>

        {/* Contextual hint: character budget for text, fetch caveat for a URL. */}
        {looksUrl ? (
          <p class="text-xs text-muted">
            The page must be publicly accessible. Paywalled articles can't be extracted — paste the text directly instead.
          </p>
        ) : (
          <div class="flex justify-between text-xs">
            <span class={charCount > 0 && charCount < MIN_CHARS ? 'text-sev-med' : charCount > MAX_CHARS ? 'text-accent' : 'text-muted'}>
              {charCount > 0 && charCount < MIN_CHARS
                ? `${MIN_CHARS - charCount} more character${MIN_CHARS - charCount === 1 ? '' : 's'} needed`
                : charCount > MAX_CHARS
                ? 'Too long - please trim to 10,000 characters'
                : ''}
            </span>
            <span class={charCount > MAX_CHARS ? 'text-accent' : 'text-muted'}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        )}

        {/* Pre-cached example picker — tucked behind a "Try an example" toggle so
            it doesn't dominate the page (Daniel: examples off the main page). Picks
            load instantly (no API) with the short delay + loading animation so it
            still feels real. Cards stay horizontal (his pref) but carry the Studio
            sample set's failure-mode tags. */}
        {!result && !loading && (
          <div>
            <button
              type="button"
              onClick={() => setShowExamples(v => !v)}
              class="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
            >
              New here? Try an example
              <svg class={`w-3 h-3 transition-transform ${showExamples ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            {showExamples && (
              <div class="mt-2 rounded-lg border border-hairline bg-paper p-2">
                <p class="px-1 pb-1.5 text-[0.625rem] uppercase tracking-wider text-muted">Pre-cached · instant, no API call</p>
                <div class="grid sm:grid-cols-3 gap-2">
                  {SAMPLES.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => loadSample(s)}
                      class="group text-left rounded-md border border-hairline bg-surface p-2.5 hover:border-accent/40 transition-colors"
                    >
                      <div class="flex items-baseline justify-between gap-1.5">
                        <span class="text-[0.75rem] font-semibold text-ink-strong leading-tight">{s.shortLabel}</span>
                        <span class="text-[0.5625rem] uppercase tracking-wider text-muted shrink-0">{s.category}</span>
                      </div>
                      <p class="text-[0.6875rem] text-muted leading-snug mt-0.5 line-clamp-1">{s.title}</p>
                      <div class="flex flex-wrap gap-1 mt-1.5">
                        {s.failureModes.slice(0, 2).map(mode => (
                          <span key={mode} class="text-[0.625rem] font-mono px-1.5 py-0.5 rounded-[2px] border border-hairline bg-paper text-muted font-medium">{mode}</span>
                        ))}
                        {s.failureModes.length > 2 && (
                          <span class="text-[0.625rem] px-1.5 py-0.5 rounded bg-hairline/40 text-muted font-medium">+{s.failureModes.length - 2}</span>
                        )}
                      </div>
                      <span class="inline-block mt-1.5 text-[0.6875rem] font-medium text-accent">See the analysis →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </form>
      )}

      {loading && <AuditLoading />}

      {error && !loading && (
        <div class="rounded-xl bg-accent/5 border border-accent/30 p-4">
          <p class="text-sm text-accent">{error}</p>
        </div>
      )}

      {/* Verdict-first results (structure 2): a one-line verdict + jump tabs, the
         findings up top (the payoff) with the highlighted draft beside them, and
         the argument structure as a section below the findings in the right
         column. Jump tabs teleport within this single scroll. */}
      {result && !loading && displayResult && (
        <div class="space-y-4">

          {/* Verdict bar */}
          <div class="rounded-lg border border-hairline bg-surface px-4 py-3 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-ink-strong">
                {counts.total} {counts.total === 1 ? 'issue' : 'issues'} found
              </span>
              {counts.critical > 0 && (
                <span class="inline-flex items-center gap-1 text-xs text-muted">
                  <span class="w-1.5 h-1.5 rounded-full bg-sev-high" aria-hidden="true" />
                  {counts.critical} critical
                </span>
              )}
            </div>
            {/* One-line structural verdict — the plain-language read of the
               finding shape (which KIND of objection dominates). */}
            <p class="text-xs text-ink leading-relaxed">{auditVerdict(displayResult)}</p>
            <p class="text-xs text-muted line-clamp-1">
              <span class="font-medium text-ink">Weakest link:</span> {result.toulmin.weakestLink}
            </p>
            {/* Scope strip — what the audit checked (its lenses). Shows base
               checks always, with counts, so a clean result reads as
               "checked, nothing found" rather than "did it run?". */}
            <div class="flex items-center gap-x-3 gap-y-1 flex-wrap pt-2 border-t border-hairline">
              <span class="text-[0.625rem] font-mono uppercase tracking-wider text-muted shrink-0">Checked</span>
              {lensesChecked(displayResult).map(l => (
                <span key={l.key} class="inline-flex items-center gap-1 text-xs text-muted">
                  {l.label}
                  <span class={`font-mono ${l.count > 0 ? 'text-ink font-medium' : 'text-muted/70'}`}>{l.count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Jump tabs — teleport within the page (not content-hiding panes).
             Mobile: a no-wrap horizontal scroll strip stuck below the top bar,
             so the nav survives the long results scroll (measured ~8 screens).
             Desktop: unchanged inline wrap row. */}
          <div class="sticky top-12 sm:static z-20 py-2 sm:py-0 bg-paper sm:bg-transparent flex items-center gap-1.5 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible text-xs">
            <span class="text-muted mr-0.5 shrink-0">Jump to</span>
            <button type="button" onClick={() => jumpTo('r-findings')} class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent hover:text-accent transition-colors">Findings</button>
            {result.loadedLanguage.length > 0 && (
              <button type="button" onClick={() => jumpTo('r-language')} class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent hover:text-accent transition-colors">Language</button>
            )}
            {hasLeftContent && (
              <button type="button" onClick={() => jumpTo('r-text')} class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent hover:text-accent transition-colors">Your text</button>
            )}
            <button type="button" onClick={() => jumpTo('r-structure')} class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent hover:text-accent transition-colors">Structure</button>
            <span class="text-hairline mx-0.5 shrink-0" aria-hidden="true">·</span>
            <a href="/#briefings" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent-support hover:text-accent-support transition-colors">Briefings →</a>
          </div>

          {/* Three foldable regions — Your text (left), Findings + Argument
             structure (right). Each is a <details>; the tabs open the target
             fold and scroll to it. */}
          <style>{`
            .rd-fold > summary { list-style: none; }
            .rd-fold > summary::-webkit-details-marker { display: none; }
            .rd-fold .rd-chevron { transition: transform .15s ease; }
            .rd-fold[open] > summary .rd-chevron { transform: rotate(180deg); }
          `}</style>
          {/* Below xl the columns stack; findings go FIRST (the payoff), the
             audited text second (reference). Measured: with text first, the
             findings started 1.7 screens down on a phone. Desktop unchanged. */}
          <div class="flex flex-col xl:flex-row gap-4 items-start">
            {hasLeftContent && (
              <details id="r-text" open class="rd-fold scroll-mt-24 order-2 xl:order-1 w-full xl:w-[55%] rounded-lg border border-hairline bg-surface">
                <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer">
                  <span class="text-xs font-semibold uppercase tracking-widest text-muted">Your text</span>
                  <svg class="rd-chevron ml-auto w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div class="px-4 pb-4 space-y-4">
                  {auditedMode === 'text' && sourceText && (
                    <HighlightedDraft
                      text={sourceText}
                      audit={displayResult}
                      activeFindingKey={null}
                      onHighlightClick={() => {}}
                    />
                  )}
                </div>
              </details>
            )}
            <div class={`w-full space-y-4 order-1 xl:order-2 ${hasLeftContent ? 'xl:w-[45%]' : ''}`}>
              <details id="r-findings" open class="rd-fold scroll-mt-24 rounded-lg border border-hairline bg-surface">
                <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer">
                  <span class="text-xs font-semibold uppercase tracking-widest text-muted">Findings</span>
                  <span class="text-xs text-muted ml-auto">{counts.total} {counts.total === 1 ? 'issue' : 'issues'}</span>
                  <svg class="rd-chevron w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div class="px-4 pb-4">
                  <AuditResults result={displayResult} scope="span" flush />
                </div>
              </details>
              <details id="r-structure" open class="rd-fold scroll-mt-24 rounded-lg border border-hairline bg-surface">
                <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer">
                  <span class="text-xs font-semibold uppercase tracking-widest text-muted">Argument structure</span>
                  <span class="text-xs text-muted normal-case tracking-normal hidden sm:inline">skeleton · assumptions · weakest link</span>
                  <svg class="rd-chevron ml-auto w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div class="px-4 pb-4 space-y-4">
                  {extraction && <ArgumentExtraction result={extraction} />}
                  <ToulminCallouts toulmin={displayResult.toulmin} />
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Strongest opposing case (free, on-demand) — the merged home of the
         retired standalone Steelman tool. */}
      {result && !loading && sourceText && (
        <ReaderOpposingCase text={sourceText} />
      )}

      {/* Deeper lenses (free, on-demand) - works for both text and URL audits
         (URL audits use server-returned extracted text). */}
      {result && !loading && sourceText && (
        <DeeperLensPanel text={sourceText} surface="reader" isPro={isPro} />
      )}

      {/* Studio conversion panel - names the Pro features the Reader doesn't
         include. Naming the locked features is the upsell. */}
      {result && !loading && (
        <div class="rounded-xl border border-hairline bg-paper p-5">
          <p class="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Go deeper in Studio</p>
          <p class="text-sm text-ink leading-relaxed mb-3">
            The Reader gives you the full structural audit free. Studio adds the tools for working on your own writing:
          </p>
          <ul class="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-ink mb-4">
            <li class="flex items-start gap-1.5"><span class="text-accent">+</span> Counterargument (steelman the other side)</li>
            <li class="flex items-start gap-1.5"><span class="text-accent">+</span> Citation audit - checks your sources</li>
            <li class="flex items-start gap-1.5"><span class="text-accent">+</span> Evidence-weighted likelihood</li>
            <li class="flex items-start gap-1.5"><span class="text-accent">+</span> Cross-document self-contradiction check</li>
            <li class="flex items-start gap-1.5"><span class="text-accent">+</span> Save drafts with version history</li>
            <li class="flex items-start gap-1.5"><span class="text-accent">+</span> Inline highlights as you edit</li>
          </ul>
          <div class="flex flex-wrap items-center gap-3">
            <a href="/creator/studio" class="inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-paper hover:bg-accent/90 transition-colors">
              Open Studio →
            </a>
            <a href="/pricing" class="text-xs text-muted hover:text-ink underline">See plans</a>
          </div>
        </div>
      )}

    </div>
  );
}
