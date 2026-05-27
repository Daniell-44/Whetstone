import { useState } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import AuditResults from './AuditResults';

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
