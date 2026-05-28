import { useState, useCallback } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import type { CounterargumentResult } from '../../lib/counterargument';
import AuditResults from '../audit/AuditResults';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: T }
  | { status: 'error'; code: string; message: string };

type AuditApiResponse =
  | { ok: true;  audit: AuditResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type CounterargApiResponse =
  | { ok: true;  result: CounterargumentResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CHARS = 50;
const MAX_CHARS = 10_000;

const AUDIT_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:  "You've reached the daily audit limit. Come back tomorrow.",
  AUDIT_FAILED:  'The structural analysis failed. Please try again in a moment.',
  INVALID_INPUT: 'Please check your input and try again.',
};

const COUNTERARG_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:  "You've reached the daily Studio limit. Come back tomorrow.",
  AUDIT_FAILED:  'The counterargument engine failed. Please try again in a moment.',
  INVALID_INPUT: 'Please check your input and try again.',
};

// ---------------------------------------------------------------------------
// Sub-components: Counterarguments
// ---------------------------------------------------------------------------

function CounterargResults({ result }: { result: CounterargumentResult }) {
  return (
    <div class="space-y-6 border-t border-gray-100 pt-8">

      <div class="bg-violet-50 border border-violet-200 rounded-xl p-5">
        <p class="text-xs font-semibold text-violet-500 uppercase tracking-widest mb-2">
          Draft's Central Claim
        </p>
        <p class="text-gray-900 text-base leading-relaxed">{result.centralClaim}</p>
      </div>

      <section>
        <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
          Strongest Opposing Positions
        </h3>
        <div class="space-y-4">
          {result.counterarguments.map((c, i) => (
            <div key={i} class="rounded-xl border border-violet-200 bg-violet-50 p-5 space-y-4">

              <p class="text-sm font-semibold text-violet-900 leading-snug">{c.position}</p>

              <div class="space-y-2 pl-4 border-l-2 border-violet-300">
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Claim</p>
                  <p class="text-sm text-gray-700 leading-relaxed">{c.strongestCase.claim}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Grounds</p>
                  <p class="text-sm text-gray-700 leading-relaxed">{c.strongestCase.grounds}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Warrant</p>
                  <p class="text-sm text-gray-700 leading-relaxed">{c.strongestCase.warrant}</p>
                </div>
              </div>

              <div class="rounded-lg bg-white border border-violet-200 p-3">
                <p class="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">
                  What your draft misses
                </p>
                <p class="text-sm text-gray-700 leading-relaxed">{c.missedByDraft}</p>
              </div>

              <p class="text-xs text-gray-400 italic leading-relaxed">{c.why}</p>

            </div>
          ))}
        </div>
      </section>

      {result.notes && (
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Notes</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{result.notes}</p>
        </section>
      )}

    </div>
  );
}

function CounterargUpsell() {
  return (
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-4">
      <p class="text-xs font-semibold uppercase tracking-widest text-amber-600">Studio Pro feature</p>
      <p class="text-sm text-gray-700 leading-relaxed max-w-sm mx-auto">
        Counterargument generation surfaces the strongest opposing positions your draft fails
        to engage with. Subscribe for $15/mo to unlock it.
      </p>
      <a
        href="/pricing"
        class="inline-block rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
      >
        See plans →
      </a>
    </div>
  );
}

function SectionError({ code, message }: { code: string; message: string }) {
  if (code === 'UNAUTHORIZED') {
    return (
      <div class="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Your session has expired.{' '}
        <a href="/login?returnTo=/creator/studio" class="underline font-medium">
          Sign in again →
        </a>
      </div>
    );
  }
  return (
    <div class="rounded-xl bg-red-50 border border-red-200 p-4">
      <p class="text-sm text-red-700">{message}</p>
    </div>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div class="rounded-xl bg-indigo-50 border border-indigo-100 p-5 text-center">
      <p class="text-sm text-indigo-700 font-medium">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor component
// ---------------------------------------------------------------------------

interface Props {
  hasActiveSubscription: boolean;
}

export default function StudioEditor({ hasActiveSubscription }: Props) {
  const [draft, setDraft]         = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [auditState, setAuditState]         = useState<SectionState<AuditResult>>({ status: 'idle' });
  const [counterargState, setCounterargState] = useState<SectionState<CounterargumentResult>>({ status: 'idle' });

  const charCount  = draft.length;
  const canSubmit  = !isRunning && charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const showResults = auditState.status !== 'idle' || (hasActiveSubscription && counterargState.status !== 'idle');

  const handleAnalyse = useCallback(() => {
    if (!canSubmit) return;
    const text = draft;

    setIsRunning(true);
    setAuditState({ status: 'loading' });
    if (hasActiveSubscription) setCounterargState({ status: 'loading' });

    let auditDone      = false;
    let counterargDone = !hasActiveSubscription; // already "done" if we won't fire it

    function checkDone() {
      if (auditDone && counterargDone) setIsRunning(false);
    }

    // Audit — always fires.
    fetch('/api/audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    })
      .then(r => r.json() as Promise<AuditApiResponse>)
      .then(data => {
        if (data.ok) {
          setAuditState({ status: 'done', data: data.audit });
        } else {
          const code = data.error.code;
          setAuditState({
            status:  'error',
            code,
            message: AUDIT_ERROR_MESSAGES[code] ?? data.error.message,
          });
        }
      })
      .catch(() => {
        setAuditState({ status: 'error', code: 'NETWORK', message: 'Network error — check your connection.' });
      })
      .finally(() => { auditDone = true; checkDone(); });

    // Counterargument — only fires for subscribers.
    if (hasActiveSubscription) {
      fetch('/api/counterargument', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      })
        .then(r => r.json() as Promise<CounterargApiResponse>)
        .then(data => {
          if (data.ok) {
            setCounterargState({ status: 'done', data: data.result });
          } else {
            const code = data.error.code;
            setCounterargState({
              status:  'error',
              code,
              message: COUNTERARG_ERROR_MESSAGES[code] ?? data.error.message,
            });
          }
        })
        .catch(() => {
          setCounterargState({ status: 'error', code: 'NETWORK', message: 'Network error — check your connection.' });
        })
        .finally(() => { counterargDone = true; checkDone(); });
    }
  }, [draft, canSubmit, hasActiveSubscription]);

  return (
    <div class="space-y-6">

      {/* Input */}
      <div class="rounded-xl border border-amber-200 bg-white p-6 space-y-4">

        <div>
          <textarea
            value={draft}
            onInput={e => setDraft((e.target as HTMLTextAreaElement).value)}
            placeholder="Paste your draft here — any argumentative text, essay, or opinion piece (50–10,000 characters)."
            rows={10}
            disabled={isRunning}
            class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition-colors disabled:opacity-60"
          />
          <div class="flex justify-between mt-1.5 text-xs">
            <span class={
              charCount > 0 && charCount < MIN_CHARS ? 'text-amber-600'
              : charCount > MAX_CHARS               ? 'text-red-500'
              :                                       'text-gray-400'
            }>
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

        <div class="space-y-2">
          <button
            type="button"
            onClick={handleAnalyse}
            disabled={!canSubmit}
            class={`w-full py-3 px-6 rounded-xl text-sm font-semibold transition-colors ${
              canSubmit
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isRunning ? 'Analysing…' : 'Analyse my draft'}
          </button>
          {isRunning && hasActiveSubscription && (
            <p class="text-xs text-center text-gray-400">
              ~30–60s — the counterargument engine takes longer than a simple audit.
            </p>
          )}
        </div>

      </div>

      {/* Results */}
      {showResults && (
        <div class="space-y-8">

          {/* Structural audit */}
          <div class="rounded-xl border border-gray-200 bg-white p-6">
            <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
              Structural Audit
            </h2>
            {auditState.status === 'loading' && (
              <SectionLoading label="Running structural audit…" />
            )}
            {auditState.status === 'error' && (
              <SectionError code={auditState.code} message={auditState.message} />
            )}
            {auditState.status === 'done' && (
              <AuditResults result={auditState.data} />
            )}
          </div>

          {/* Counterarguments */}
          <div class="rounded-xl border border-violet-200 bg-white p-6">
            <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
              Counterarguments
            </h2>
            {!hasActiveSubscription ? (
              <CounterargUpsell />
            ) : (
              <>
                {counterargState.status === 'loading' && (
                  <SectionLoading label="Generating strongest opposing positions…" />
                )}
                {counterargState.status === 'error' && (
                  <SectionError code={counterargState.code} message={counterargState.message} />
                )}
                {counterargState.status === 'done' && (
                  <CounterargResults result={counterargState.data} />
                )}
              </>
            )}
          </div>

        </div>
      )}

      {/* Upsell shown before first run when not subscribed */}
      {!showResults && !hasActiveSubscription && (
        <div class="rounded-xl border border-violet-200 bg-white p-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
            Counterarguments
          </h2>
          <CounterargUpsell />
        </div>
      )}

    </div>
  );
}
