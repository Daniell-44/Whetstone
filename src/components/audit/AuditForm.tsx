import { useState, useEffect, useRef } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import { totalFindingCount } from '../../lib/audit';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import AuditResults from './AuditResults';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import HighlightedDraft from '../studio/HighlightedDraft';
import DeeperLensPanel from '../lens-panel/DeeperLensPanel';
import ReaderOpposingCase from '../counterargument/ReaderOpposingCase';
import { applyContextualSeverity } from '../../../functions/_lib/audit/contextual-severity';
import { track } from '../../lib/analytics/track';

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

// One-click starters for first-time visitors ("beat the blank page"). These are
// illustrative demo inputs, NOT published editorial — each is a short argument
// carrying real logical issues for the engine to find. Safe to swap or extend.
const EXAMPLES: { label: string; text: string }[] = [
  {
    label: 'a political claim',
    text: `Every year we wait to cut taxes, working families fall further behind. My opponent has never run a business, so he simply cannot be trusted with the economy. The choice is simple: either we cut taxes now, or we accept permanent decline. Last time we tried his approach, unemployment went up — so the verdict is already in.`,
  },
  {
    label: 'a news op-ed',
    text: `The new policy is a disaster. Crime rose in the three months after it passed, which proves the reform caused it. Experts everywhere agree the old system worked better, and no serious person still defends the change. If we truly cared about victims, we would repeal it tomorrow.`,
  },
  {
    label: 'a debate transcript',
    text: `A: We should ban the app — it's addictive and it harms teenagers. B: So you want the government controlling everything we do online? A: That's not what I said. B: Either the market decides or bureaucrats do; there is no middle ground. And screen time is up, so the app is obviously to blame for rising anxiety.`,
  },
];

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

export default function AuditForm({ isPro = false, initialText = '', initialUrl = '' }: { isPro?: boolean; initialText?: string; initialUrl?: string }) {
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
  const formRef = useRef<HTMLDivElement>(null);

  // /?audit=<slug> or /?url=<src> deep-link from a briefing: pre-load the field
  // and bring it into view. We deliberately don't auto-run — the reader presses
  // the button — so a crawler or accidental prefetch can't burn audit quota.
  useEffect(() => {
    if (initialUrl && initialUrl.startsWith('http')) {
      setInput(initialUrl);
      setLoadedFromLink(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (initialText && initialText.length >= MIN_CHARS) {
      setInput(initialText);
      setLoadedFromLink(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const trimmed   = input.trim();
  const looksUrl  = URL_RE.test(trimmed);
  const charCount = input.length;
  const textValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const canSubmit = !loading && (looksUrl || textValid);
  // The left panel only has content for text audits (highlighted draft) or when
  // an extraction skeleton came back. For URL audits it's empty, so findings
  // take the full width instead of a 45% column.
  const hasLeftContent = (auditedMode === 'text' && !!sourceText) || !!extraction;
  // A4 experimental flag (off by default) — `?ctxsev=1` re-bands severities by
  // argument context for A/B evaluation. Never on in production.
  const ctxSev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ctxsev') === '1';

  // Core audit runner, shared by the form submit and the example chips.
  async function runAudit(raw: string) {
    const t      = raw.trim();
    const isUrl  = URL_RE.test(t);
    const isText = !isUrl;
    // Guard: text needs to clear the length bounds; URLs always pass.
    if (isText && !(raw.length >= MIN_CHARS && raw.length <= MAX_CHARS)) return;

    setLoading(true);
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

  // Example chip: fill the field with the sample and run it immediately, so a
  // first-time visitor sees a real audit without having anything to paste.
  function loadExample(text: string) {
    setInput(text);
    runAudit(text);
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
            <span class={charCount > 0 && charCount < MIN_CHARS ? 'text-amber-600' : charCount > MAX_CHARS ? 'text-red-500' : 'text-muted'}>
              {charCount > 0 && charCount < MIN_CHARS
                ? `${MIN_CHARS - charCount} more character${MIN_CHARS - charCount === 1 ? '' : 's'} needed`
                : charCount > MAX_CHARS
                ? 'Too long - please trim to 10,000 characters'
                : ''}
            </span>
            <span class={charCount > MAX_CHARS ? 'text-red-500' : 'text-muted'}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        )}

        {/* Example starters — one click loads a real argument and runs it. Hidden
            once a result is on screen (past the blank-page stage). */}
        {!result && !loading && (
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-muted">New here? Try</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex.label}
                type="button"
                onClick={() => loadExample(ex.text)}
                class="text-xs px-3 py-1 rounded-full border border-hairline text-ink hover:border-accent hover:text-accent transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}
      </form>

      {loading && <AuditLoading />}

      {error && !loading && (
        <div class="rounded-xl bg-red-50 border border-red-200 p-4">
          <p class="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Split-panel results - text with highlights left, findings right */}
      {result && !loading && (
        <div class="flex flex-col xl:flex-row gap-4 items-start">

          {/* Left: highlighted text + extraction (only when there's something to show) */}
          {hasLeftContent && (
            <div class="w-full xl:w-[55%] space-y-4">
              {auditedMode === 'text' && sourceText && (
                <HighlightedDraft
                  text={sourceText}
                  audit={result}
                  activeFindingKey={null}
                  onHighlightClick={() => {}}
                />
              )}
              {extraction && (
                <div class="rounded-lg border border-emerald-200 bg-surface p-4">
                  <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                    Argument Skeleton
                  </h3>
                  <ArgumentExtraction result={extraction} />
                </div>
              )}
            </div>
          )}

          {/* Right: findings — full width when there's no left panel (e.g. URL audits) */}
          <div class={`w-full ${hasLeftContent ? 'xl:w-[45%] xl:sticky xl:top-4 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto' : ''}`}>
            <div class="rounded-lg border border-hairline bg-surface p-4">
              <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Findings</h3>
              <AuditResults result={ctxSev && extraction ? applyContextualSeverity(result, extraction) : result} />
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
        <div class="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
          <p class="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-2">Go deeper in Studio</p>
          <p class="text-sm text-ink leading-relaxed mb-3">
            The Reader gives you the full structural audit free. Studio adds the tools for working on your own writing:
          </p>
          <ul class="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-ink mb-4">
            <li class="flex items-start gap-1.5"><span class="text-amber-500">+</span> Counterargument (steelman the other side)</li>
            <li class="flex items-start gap-1.5"><span class="text-amber-500">+</span> Citation audit - checks your sources</li>
            <li class="flex items-start gap-1.5"><span class="text-amber-500">+</span> Evidence-weighted likelihood</li>
            <li class="flex items-start gap-1.5"><span class="text-amber-500">+</span> Cross-document self-contradiction check</li>
            <li class="flex items-start gap-1.5"><span class="text-amber-500">+</span> Save drafts with version history</li>
            <li class="flex items-start gap-1.5"><span class="text-amber-500">+</span> Inline highlights as you edit</li>
          </ul>
          <div class="flex flex-wrap items-center gap-3">
            <a href="/creator/studio" class="inline-block rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors">
              Open Studio →
            </a>
            <a href="/pricing" class="text-xs text-muted hover:text-ink underline">See plans</a>
          </div>
        </div>
      )}

    </div>
  );
}
