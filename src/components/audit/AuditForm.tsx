import { useState } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'text' | 'url';

type ApiResponse =
  | { ok: true;  audit: AuditResult; usage: { inputTokens: number; outputTokens: number } }
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
  FETCH_FAILED:      "Couldn't reach that URL — check it's publicly accessible, or paste the text directly.",
  AUDIT_FAILED:      'The analysis failed. Please try again in a moment.',
  INVALID_INPUT:     'Please check your input and try again.',
};

const SEVERITY_CARD: Record<string, string> = {
  high:   'bg-red-50 border-red-200',
  medium: 'bg-amber-50 border-amber-200',
  low:    'bg-gray-50 border-gray-200',
};

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AuditForm() {
  const [tab, setTab]           = useState<Tab>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<AuditResult | null>(null);

  const charCount  = textInput.length;
  const textValid  = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const urlValid   = urlInput.trim().startsWith('http');
  const canSubmit  = !loading && (tab === 'text' ? textValid : urlValid);

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const body = tab === 'text'
      ? { text: textInput }
      : { url: urlInput.trim() };

    try {
      const res  = await fetch('/api/audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = (await res.json()) as ApiResponse;
      if (data.ok) {
        setResult(data.audit);
      } else {
        const code = data.error.code;
        setError(ERROR_MESSAGES[code] ?? data.error.message ?? 'Something went wrong.');
      }
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="space-y-5">

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
              placeholder="Paste an article, speech, debate excerpt, or any argumentative text…"
              rows={9}
              class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-colors"
            />
            <div class="flex justify-between mt-1.5 text-xs">
              <span class={charCount > 0 && charCount < MIN_CHARS ? 'text-amber-600' : charCount > MAX_CHARS ? 'text-red-500' : 'text-gray-400'}>
                {charCount > 0 && charCount < MIN_CHARS
                  ? `${MIN_CHARS - charCount} more character${MIN_CHARS - charCount === 1 ? '' : 's'} needed`
                  : charCount > MAX_CHARS
                  ? 'Too long — please trim to 10,000 characters'
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
              The page must be publicly accessible. Paywalled articles can't be extracted — paste the text directly instead.
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

      {loading && (
        <div class="rounded-xl bg-indigo-50 border border-indigo-100 p-5 text-center">
          <p class="text-sm text-indigo-700 font-medium">
            Reading and analysing — this takes 15–30 seconds.
          </p>
          <p class="text-xs text-indigo-400 mt-1">
            The engine maps the argument structure and checks for logical issues.
          </p>
        </div>
      )}

      {error && !loading && (
        <div class="rounded-xl bg-red-50 border border-red-200 p-4">
          <p class="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && !loading && <AuditResults result={result} />}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function AuditResults({ result }: { result: AuditResult }) {
  const hasFindings = result.namedFallacies.length > 0 || result.loadedLanguage.length > 0;

  return (
    <div class="space-y-8 border-t border-gray-100 pt-8">

      {/* Central claim */}
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-2">
          Central Claim
        </p>
        <p class="text-gray-900 text-base leading-relaxed">{result.centralClaim}</p>
      </div>

      {/* Toulmin breakdown */}
      <section>
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Argument Structure
        </h2>
        <details class="mb-5">
          <summary class="text-xs text-indigo-400 cursor-pointer list-none hover:text-indigo-600 w-fit">
            ↳ What is Toulmin analysis?
          </summary>
          <p class="mt-2 text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-3">
            Toulmin's framework maps an argument into its <strong>claim</strong> (the conclusion being argued for),
            <strong> grounds</strong> (the evidence offered in support), <strong>warrant</strong> (the principle connecting
            evidence to conclusion), and <strong>unstated assumptions</strong> — premises the argument relies on but never
            makes explicit. The <strong>weakest link</strong> is the element most open to challenge.
          </p>
        </details>

        <dl class="space-y-4">
          <ToulminRow label="Claim"   text={result.toulmin.claim} />
          <ToulminRow label="Grounds" text={result.toulmin.grounds} />
          {result.toulmin.statedWarrant && (
            <ToulminRow label="Stated warrant" text={result.toulmin.statedWarrant} />
          )}

          {result.toulmin.unstatedWarrants.length > 0 && (
            <div>
              <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2 flex-wrap">
                Unstated warrants
                <details class="font-normal normal-case tracking-normal inline">
                  <summary class="text-indigo-400 cursor-pointer list-none hover:text-indigo-600 text-xs">
                    What's this?
                  </summary>
                  <p class="mt-1 text-gray-400 text-xs leading-relaxed bg-gray-50 rounded p-2 max-w-sm font-normal tracking-normal normal-case">
                    Assumptions the argument needs in order to hold, but never states explicitly.
                    Every argument has at least one.
                  </p>
                </details>
              </dt>
              <dd class="space-y-3">
                {result.toulmin.unstatedWarrants.map((w, i) => (
                  <div key={i} class="pl-4 border-l-2 border-indigo-200">
                    <p class="text-sm text-gray-700 leading-relaxed mb-1">{w.warrant}</p>
                    <p class="text-xs text-gray-400 leading-snug italic">{w.necessity}</p>
                  </div>
                ))}
              </dd>
            </div>
          )}

          <div class="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <dt class="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              Weakest link
            </dt>
            <dd class="text-sm text-amber-900 leading-relaxed">{result.toulmin.weakestLink}</dd>
          </div>
        </dl>
      </section>

      {/* Findings or empty state */}
      {!hasFindings ? (
        <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
          <p class="text-sm text-emerald-700">
            No named fallacies or loaded language detected — the argument's structural integrity
            is the focus of the analysis above.
          </p>
        </div>
      ) : (
        <>
          {result.namedFallacies.length > 0 && (
            <section>
              <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Named Fallacies
              </h2>
              <div class="space-y-3">
                {result.namedFallacies.map((f, i) => (
                  <FallacyCard key={i} fallacy={f} />
                ))}
              </div>
            </section>
          )}

          {result.loadedLanguage.length > 0 && (
            <section>
              <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                Loaded Language
              </h2>
              <div class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
                {result.loadedLanguage.map((item, i) => (
                  <LoadedLanguageRow key={i} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {result.notes && (
        <section>
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Notes
          </h2>
          <p class="text-sm text-gray-600 leading-relaxed">{result.notes}</p>
        </section>
      )}

    </div>
  );
}

function ToulminRow({ label, text }: { label: string; text: string }) {
  return (
    <div class="pl-4 border-l-2 border-indigo-200">
      <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd class="text-sm text-gray-700 leading-relaxed">{text}</dd>
    </div>
  );
}

function FallacyCard({ fallacy }: { fallacy: AuditResult['namedFallacies'][number] }) {
  const cardCls  = SEVERITY_CARD[fallacy.severity]  ?? 'bg-gray-50 border-gray-200';
  const badgeCls = SEVERITY_BADGE[fallacy.severity] ?? 'bg-gray-100 text-gray-600';

  return (
    <div class={`rounded-xl border p-4 ${cardCls}`}>
      <div class="flex items-start justify-between gap-2 mb-3">
        <p class="text-sm font-semibold text-gray-900">{fallacy.name}</p>
        <span class={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badgeCls}`}>
          {fallacy.severity}
        </span>
      </div>
      <blockquote class="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-3 mb-2 leading-relaxed">
        "{fallacy.quote}"
      </blockquote>
      <p class="text-xs text-gray-600 leading-relaxed">{fallacy.explanation}</p>
    </div>
  );
}

function LoadedLanguageRow({ item }: { item: AuditResult['loadedLanguage'][number] }) {
  return (
    <div class="px-4 py-3">
      <div class="flex items-start gap-2 mb-1 flex-wrap">
        <span class="text-sm font-medium text-gray-900">"{item.phrase}"</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0 mt-0.5">
          {item.technique}
        </span>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">{item.explanation}</p>
    </div>
  );
}
