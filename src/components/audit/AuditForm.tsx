import { useState, useEffect, useRef } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import { totalFindingCount } from '../../lib/audit';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import AuditResults from './AuditResults';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import HighlightedDraft from '../studio/HighlightedDraft';
import DeeperLensPanel from '../lens-panel/DeeperLensPanel';
import { track } from '../../lib/analytics/track';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'text' | 'url';

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

const ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:      "You've reached the daily audit limit. Come back tomorrow to run more audits.",
  EXTRACTION_FAILED: "Couldn't extract the article text from that URL. Try pasting the text directly using the Text tab.",
  TOO_SHORT:         'The extracted text was too short to audit. Try pasting the full article text directly.',
  NOT_HTML:          "That URL doesn't point to an HTML page. Try pasting the text directly using the Text tab.",
  FETCH_FAILED:      "Couldn't reach that URL - check it's publicly accessible, or paste the text directly.",
  AUDIT_FAILED:      'The analysis failed. Please try again in a moment.',
  INVALID_INPUT:     'Please check your input and try again.',
};

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
      <div class="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm font-medium text-indigo-700">Reading and analysing the argument…</p>
          <span class="text-xs text-indigo-400 tabular-nums">{Math.round(pct)}%</span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-indigo-100 overflow-hidden">
          <div class="h-full rounded-full bg-indigo-500 transition-[width] duration-500 ease-out" style={`width:${pct}%`} />
        </div>
        <p class="text-xs text-indigo-400 mt-2">Mapping the structure and checking for logical issues — usually 10–20 seconds.</p>
      </div>

      <div class="flex flex-col xl:flex-row gap-4 items-start">
        <div class="w-full xl:w-[55%] rounded-lg border border-gray-200 bg-white p-4 space-y-2.5">
          <div class="h-2.5 w-1/3 rounded bg-gray-200 animate-pulse" />
          <div class="h-2 w-full rounded bg-gray-100 animate-pulse" />
          <div class="h-2 w-11/12 rounded bg-gray-100 animate-pulse" />
          <div class="h-2 w-5/6 rounded bg-gray-100 animate-pulse" />
          <div class="h-2 w-full rounded bg-gray-100 animate-pulse" />
          <div class="h-2 w-2/3 rounded bg-gray-100 animate-pulse" />
        </div>
        <div class="w-full xl:w-[45%] rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div class="h-2.5 w-1/4 rounded bg-gray-200 animate-pulse" />
          {[0, 1, 2].map(i => (
            <div key={i} class="rounded-md border border-gray-100 p-2.5 space-y-1.5">
              <div class="h-2 w-1/2 rounded bg-gray-200 animate-pulse" />
              <div class="h-2 w-full rounded bg-gray-100 animate-pulse" />
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

export default function AuditForm({ isPro = false, initialText = '' }: { isPro?: boolean; initialText?: string }) {
  const [tab, setTab]             = useState<Tab>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<AuditResult | null>(null);
  const [extraction, setExtraction] = useState<ArgumentExtractionResult | null>(null);
  const [loadedFromLink, setLoadedFromLink] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  // The text the audit ran against - used to drive the deeper-lens panel.
  // For text-tab audits it equals textInput; for URL audits it's the extracted article body.
  const [sourceText, setSourceText] = useState<string>('');

  // /?audit=<slug> deep-link from a briefing: pre-load the text and bring the
  // reader into view. We deliberately don't auto-run — the reader presses Audit
  // — so a crawler or accidental prefetch of the link can't burn audit quota.
  useEffect(() => {
    if (initialText && initialText.length >= MIN_CHARS) {
      setTab('text');
      setTextInput(initialText);
      setLoadedFromLink(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const charCount = textInput.length;
  const textValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const urlValid  = urlInput.trim().startsWith('http');
  const canSubmit = !loading && (tab === 'text' ? textValid : urlValid);

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setExtraction(null);

    const isText = tab === 'text';
    const body   = isText ? { text: textInput } : { url: urlInput.trim() };
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
            body:    JSON.stringify({ text: textInput }),
          }).then(r => r.json() as Promise<ExtractionApiResponse>),
        );
      }

      const [auditData, extractionData] = await Promise.allSettled(requests);

      // Handle audit result
      if (auditData.status === 'fulfilled') {
        const data = auditData.value as AuditApiResponse;
        if (data.ok) {
          setResult(data.audit);
          // Store the text the audit ran against (server-extracted for URLs)
          // so the deeper-lens panel can fire follow-up calls.
          setSourceText(data.sourceText ?? (isText ? textInput : ''));
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

      // Handle extraction result (best-effort - don't block audit display on failure)
      if (extractionData && extractionData.status === 'fulfilled') {
        const data = extractionData.value as ExtractionApiResponse;
        if (data.ok) setExtraction(data.extraction);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="space-y-5" ref={formRef}>

      {loadedFromLink && (
        <div class="rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-2.5">
          <p class="text-xs text-indigo-700">
            Loaded from a briefing — press <span class="font-semibold">Audit this argument</span> to run the full structural audit on it.
          </p>
        </div>
      )}

      {/* Tab switcher */}
      <div class="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {(['text', 'url'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            class={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'text' ? 'Paste text' : 'Paste URL'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} class="space-y-3">
        {tab === 'text' ? (
          <div>
            <textarea
              value={textInput}
              onInput={e => setTextInput((e.target as HTMLTextAreaElement).value)}
              placeholder="Paste an article, speech, or any argumentative text…"
              rows={1}
              class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-colors"
              style={`min-height: ${loadedFromLink ? 180 : 44}px;`}
            />
            <div class="flex justify-between mt-1.5 text-xs">
              <span class={charCount > 0 && charCount < MIN_CHARS ? 'text-amber-600' : charCount > MAX_CHARS ? 'text-red-500' : 'text-gray-400'}>
                {charCount > 0 && charCount < MIN_CHARS
                  ? `${MIN_CHARS - charCount} more character${MIN_CHARS - charCount === 1 ? '' : 's'} needed`
                  : charCount > MAX_CHARS
                  ? 'Too long - please trim to 10,000 characters'
                  : ''}
              </span>
              <span class={charCount > MAX_CHARS ? 'text-red-500' : 'text-gray-400'}>
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <input
              type="url"
              value={urlInput}
              onInput={e => setUrlInput((e.target as HTMLInputElement).value)}
              placeholder="https://example.com/article"
              class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-colors"
            />
            <p class="mt-1.5 text-xs text-gray-400">
              The page must be publicly accessible. Paywalled articles can't be extracted - paste the text directly instead.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          class={`w-full py-3 px-6 rounded-xl text-sm font-semibold transition-colors ${
            canSubmit
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? 'Analysing…' : 'Audit this argument'}
        </button>
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

          {/* Left: highlighted text + extraction */}
          <div class="w-full xl:w-[55%] space-y-4">
            {tab === 'text' && textInput && (
              <HighlightedDraft
                text={textInput}
                audit={result}
                activeFindingKey={null}
                onHighlightClick={() => {}}
              />
            )}
            {extraction && (
              <div class="rounded-lg border border-emerald-200 bg-white p-4">
                <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Argument Skeleton
                </h3>
                <ArgumentExtraction result={extraction} />
              </div>
            )}
          </div>

          {/* Right: findings */}
          <div class="w-full xl:w-[45%] xl:sticky xl:top-4 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto">
            <div class="rounded-lg border border-gray-200 bg-white p-4">
              <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Findings</h3>
              <AuditResults result={result} />
            </div>
          </div>

        </div>
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
          <p class="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-2">Go deeper in Studio</p>
          <p class="text-sm text-gray-700 leading-relaxed mb-3">
            The Reader gives you the full structural audit free. Studio adds the tools for working on your own writing:
          </p>
          <ul class="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-600 mb-4">
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
            <a href="/pricing" class="text-xs text-gray-500 hover:text-gray-700 underline">See plans</a>
          </div>
        </div>
      )}

    </div>
  );
}
