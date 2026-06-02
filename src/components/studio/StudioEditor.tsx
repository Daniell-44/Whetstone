import { useState, useCallback } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import type { CounterargumentResult } from '../../lib/counterargument';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import type { PhilosophicalCommitmentsResult } from '../../../functions/_lib/philosophical-commitments/types';
import type { CitationAuditResult } from '../../../functions/_lib/citation-audit/types';
import AuditResults from '../audit/AuditResults';
import CounterargumentResultDisplay from './CounterargumentResultDisplay';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import PhilosophicalCommitmentsDisplay from '../commitments/PhilosophicalCommitmentsDisplay';
import CitationAuditDisplay from '../citation-audit/CitationAuditDisplay';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import type { TerminologyPreference } from '../../lib/labels';
import SummaryToolbar from '../audit/SummaryToolbar';

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

type ExtractionApiResponse =
  | { ok: true;  extraction: ArgumentExtractionResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type CommitmentsApiResponse =
  | { ok: true;  result: PhilosophicalCommitmentsResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type CitationAuditApiResponse =
  | { ok: true;  result: CitationAuditResult; usage: { inputTokens: number; outputTokens: number; citationsFetched: number; citationsFailed: number } }
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

const EXTRACTION_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:      "You've reached the daily limit. Come back tomorrow.",
  EXTRACTION_FAILED: 'The argument extraction failed. Please try again in a moment.',
  INVALID_INPUT:     'Please check your input and try again.',
};

const COMMITMENTS_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:        "You've reached the daily Framework Check limit. Come back tomorrow.",
  COMMITMENTS_FAILED:  'The framework analysis failed. Please try again in a moment.',
  INVALID_INPUT:       'Please check your input and try again.',
};

const CITATION_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:            "You've reached the daily Source Match limit. Come back tomorrow.",
  CITATION_AUDIT_FAILED:   'The citation audit failed. Please try again in a moment.',
  INVALID_INPUT:           'Please check your input and try again.',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CitationUpsell() {
  return (
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-4">
      <p class="text-xs font-semibold uppercase tracking-widest text-amber-600">Studio Pro feature</p>
      <p class="text-sm text-gray-700 leading-relaxed max-w-sm mx-auto">
        Source Match fetches every cited URL in your draft and checks whether the source
        actually supports the claim. Subscribe to unlock it.
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

function CounterargUpsell() {
  return (
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-4">
      <p class="text-xs font-semibold uppercase tracking-widest text-amber-600">Studio Pro feature</p>
      <p class="text-sm text-gray-700 leading-relaxed max-w-sm mx-auto">
        The opposing-cases engine surfaces the strongest objections your draft fails
        to engage with. Subscribe for $22/mo to unlock it.
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
  hasActiveSubscription:        boolean;
  initialDocId?:                string | null;
  initialTitle?:                string;
  initialContent?:              string;
  initialVersionId?:            string | null;
  initialAuditResult?:          AuditResult | null;
  initialCounterargResult?:     CounterargumentResult | null;
  initialExtractionResult?:     ArgumentExtractionResult | null;
  initialCommitmentsResult?:    PhilosophicalCommitmentsResult | null;
  initialCitationAuditResult?:  CitationAuditResult | null;
  initialActions?:              Record<string, { id: string; action: string; reason?: string | null; updatedAt: number }>;
  terminologyPreference?:       TerminologyPreference;
}

export default function StudioEditor({
  hasActiveSubscription,
  initialDocId                = null,
  initialTitle                = 'Untitled draft',
  initialContent              = '',
  initialVersionId            = null,
  initialAuditResult          = null,
  initialCounterargResult     = null,
  initialExtractionResult     = null,
  initialCommitmentsResult    = null,
  initialCitationAuditResult  = null,
  initialActions              = {},
  terminologyPreference,
}: Props) {
  const [draft, setDraft]         = useState(initialContent);
  const [docId, setDocId]         = useState<string | null>(initialDocId);
  const [versionId, setVersionId] = useState<string | null>(initialVersionId);
  const [title, setTitle]         = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [lastSavedContent, setLastSavedContent] = useState<string | null>(
    initialVersionId ? initialContent : null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [auditState, setAuditState] = useState<SectionState<AuditResult>>(
    initialAuditResult ? { status: 'done', data: initialAuditResult } : { status: 'idle' },
  );
  const [counterargState, setCounterargState] = useState<SectionState<CounterargumentResult>>(
    initialCounterargResult ? { status: 'done', data: initialCounterargResult } : { status: 'idle' },
  );
  const [extractionState, setExtractionState] = useState<SectionState<ArgumentExtractionResult>>(
    initialExtractionResult ? { status: 'done', data: initialExtractionResult } : { status: 'idle' },
  );
  const [commitmentsState, setCommitmentsState] = useState<SectionState<PhilosophicalCommitmentsResult>>(
    initialCommitmentsResult ? { status: 'done', data: initialCommitmentsResult } : { status: 'idle' },
  );
  const [citationState, setCitationState] = useState<SectionState<CitationAuditResult>>(
    initialCitationAuditResult ? { status: 'done', data: initialCitationAuditResult } : { status: 'idle' },
  );

  const charCount   = draft.length;
  const canSubmit   = !isRunning && charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const showResults = auditState.status !== 'idle' || extractionState.status !== 'idle' || (hasActiveSubscription && (counterargState.status !== 'idle' || commitmentsState.status !== 'idle' || citationState.status !== 'idle'));

  const handleTitleBlur = useCallback(async () => {
    if (!docId || title === savedTitle) return;
    try {
      await fetch(`/api/documents/${docId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title }),
      });
      setSavedTitle(title);
    } catch { /* best-effort */ }
  }, [docId, title, savedTitle]);

  const handleNewDraft = useCallback(() => {
    setDocId(null);
    setVersionId(null);
    setTitle('Untitled draft');
    setSavedTitle('Untitled draft');
    setDraft('');
    setLastSavedContent(null);
    setAuditState({ status: 'idle' });
    setCounterargState({ status: 'idle' });
    setExtractionState({ status: 'idle' });
    setCommitmentsState({ status: 'idle' });
    setCitationState({ status: 'idle' });
    const url = new URL(window.location.href);
    url.searchParams.delete('doc');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const handleAnalyse = useCallback(async () => {
    if (!canSubmit) return;
    const text = draft;

    setIsRunning(true);

    // --- ensure document + version exist ---
    let currentDocId     = docId;
    let currentVersionId = versionId;

    try {
      if (!currentDocId) {
        const res  = await fetch('/api/documents', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ title, content: text }),
        });
        const data = await res.json() as { ok: boolean; docId?: string; versionId?: string };
        if (!data.ok || !data.docId) { setIsRunning(false); return; }
        currentDocId     = data.docId;
        currentVersionId = data.versionId ?? null;
        setDocId(currentDocId);
        setVersionId(currentVersionId);
        setLastSavedContent(text);
        setSavedTitle(title);
        const url = new URL(window.location.href);
        url.searchParams.set('doc', currentDocId);
        window.history.replaceState({}, '', url.toString());
      } else if (text !== lastSavedContent) {
        const res  = await fetch(`/api/documents/${currentDocId}/versions`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ content: text }),
        });
        const data = await res.json() as { ok: boolean; versionId?: string };
        if (!data.ok || !data.versionId) { setIsRunning(false); return; }
        currentVersionId = data.versionId;
        setVersionId(currentVersionId);
        setLastSavedContent(text);
      }
    } catch {
      setIsRunning(false);
      return;
    }

    if (!currentDocId || !currentVersionId) { setIsRunning(false); return; }

    // --- run analysis ---
    setExtractionState({ status: 'loading' });
    setAuditState({ status: 'loading' });
    if (hasActiveSubscription) {
      setCounterargState({ status: 'loading' });
      setCommitmentsState({ status: 'loading' });
      setCitationState({ status: 'loading' });
    }

    let extractionDone  = false;
    let auditDone       = false;
    let counterargDone  = !hasActiveSubscription;
    let commitmentsDone = !hasActiveSubscription;
    let citationDone    = !hasActiveSubscription;

    function checkDone() {
      if (extractionDone && auditDone && counterargDone && commitmentsDone && citationDone) setIsRunning(false);
    }

    const versionPath = `/api/documents/${currentDocId}/versions/${currentVersionId}`;

    fetch(`${versionPath}/extraction`, { method: 'POST' })
      .then(r => r.json() as Promise<ExtractionApiResponse>)
      .then(data => {
        if (data.ok) {
          setExtractionState({ status: 'done', data: data.extraction });
        } else {
          const code = data.error.code;
          setExtractionState({ status: 'error', code, message: EXTRACTION_ERROR_MESSAGES[code] ?? data.error.message });
        }
      })
      .catch(() => setExtractionState({ status: 'error', code: 'NETWORK', message: 'Network error — check your connection.' }))
      .finally(() => { extractionDone = true; checkDone(); });

    fetch(`${versionPath}/audit`, { method: 'POST' })
      .then(r => r.json() as Promise<AuditApiResponse>)
      .then(data => {
        if (data.ok) {
          setAuditState({ status: 'done', data: data.audit });
        } else {
          const code = data.error.code;
          setAuditState({ status: 'error', code, message: AUDIT_ERROR_MESSAGES[code] ?? data.error.message });
        }
      })
      .catch(() => setAuditState({ status: 'error', code: 'NETWORK', message: 'Network error — check your connection.' }))
      .finally(() => { auditDone = true; checkDone(); });

    if (hasActiveSubscription) {
      fetch(`${versionPath}/counterargument`, { method: 'POST' })
        .then(r => r.json() as Promise<CounterargApiResponse>)
        .then(data => {
          if (data.ok) {
            setCounterargState({ status: 'done', data: data.result });
          } else {
            const code = data.error.code;
            setCounterargState({ status: 'error', code, message: COUNTERARG_ERROR_MESSAGES[code] ?? data.error.message });
          }
        })
        .catch(() => setCounterargState({ status: 'error', code: 'NETWORK', message: 'Network error — check your connection.' }))
        .finally(() => { counterargDone = true; checkDone(); });

      fetch(`${versionPath}/commitments`, { method: 'POST' })
        .then(r => r.json() as Promise<CommitmentsApiResponse>)
        .then(data => {
          if (data.ok) {
            setCommitmentsState({ status: 'done', data: data.result });
          } else {
            const code = data.error.code;
            setCommitmentsState({ status: 'error', code, message: COMMITMENTS_ERROR_MESSAGES[code] ?? data.error.message });
          }
        })
        .catch(() => setCommitmentsState({ status: 'error', code: 'NETWORK', message: 'Network error — check your connection.' }))
        .finally(() => { commitmentsDone = true; checkDone(); });

      // Citation audit — fires with the raw draft text (standalone endpoint)
      fetch('/api/citation-audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      })
        .then(r => r.json() as Promise<CitationAuditApiResponse>)
        .then(data => {
          if (data.ok) {
            setCitationState({ status: 'done', data: data.result });
          } else {
            const code = data.error.code;
            setCitationState({ status: 'error', code, message: CITATION_ERROR_MESSAGES[code] ?? data.error.message });
          }
        })
        .catch(() => setCitationState({ status: 'error', code: 'NETWORK', message: 'Network error — check your connection.' }))
        .finally(() => { citationDone = true; checkDone(); });
    }
  }, [draft, docId, versionId, lastSavedContent, title, canSubmit, hasActiveSubscription]);

  // ---------------------------------------------------------------------------
  // Input section (always visible)
  // ---------------------------------------------------------------------------

  const inputSection = (
    <>
      {/* Document title + actions */}
      <div class="flex items-center gap-3">
        <input
          type="text"
          value={title}
          onInput={e => setTitle((e.target as HTMLInputElement).value)}
          onBlur={handleTitleBlur}
          maxLength={200}
          placeholder="Untitled draft"
          disabled={isRunning}
          class="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition-colors disabled:opacity-60"
        />
        {docId && (
          <a
            href={`/creator/documents/${docId}/versions`}
            class="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
          >
            History
          </a>
        )}
        {hasActiveSubscription && (
          <button
            type="button"
            onClick={handleNewDraft}
            disabled={isRunning}
            class="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-40"
          >
            New draft
          </button>
        )}
      </div>

      {/* Textarea + button */}
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
              ~60–90s — fetching cited sources and finding opposing cases takes longer than a simple audit.
            </p>
          )}
        </div>
      </div>
    </>
  );

  // ---------------------------------------------------------------------------
  // Results section
  // ---------------------------------------------------------------------------

  const resultsSection = showResults ? (
    <div class="space-y-6">
      {/* Argument extraction — shown above critique */}
      {extractionState.status !== 'idle' && (
        <div class="rounded-xl border border-emerald-200 bg-white p-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
            Argument Skeleton
          </h2>
          {extractionState.status === 'loading' && (
            <SectionLoading label="Mapping argument structure…" />
          )}
          {extractionState.status === 'error' && (
            <SectionError code={extractionState.code} message={extractionState.message} />
          )}
          {extractionState.status === 'done' && (
            <ArgumentExtraction result={extractionState.data} terminologyPreference={terminologyPreference} />
          )}
        </div>
      )}

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
          <AuditResults
            result={auditState.data}
            documentId={docId}
            versionId={versionId}
            initialActions={initialActions}
            terminologyPreference={terminologyPreference}
          />
        )}
      </div>

      {/* Counterarguments */}
      <div class="rounded-xl border border-violet-200 bg-white p-6">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
          <LabelWithTooltip label="counterarguments" preference={terminologyPreference} />
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
              <CounterargumentResultDisplay result={counterargState.data} terminologyPreference={terminologyPreference} />
            )}
          </>
        )}
      </div>

      {/* Framework Check — subscribed users only */}
      {hasActiveSubscription && commitmentsState.status !== 'idle' && (
        <div class="rounded-xl border border-purple-200 bg-white p-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
            <LabelWithTooltip label="commitments" preference={terminologyPreference} />
          </h2>
          {commitmentsState.status === 'loading' && (
            <SectionLoading label="Detecting philosophical frameworks…" />
          )}
          {commitmentsState.status === 'error' && (
            <SectionError code={commitmentsState.code} message={commitmentsState.message} />
          )}
          {commitmentsState.status === 'done' && (
            <PhilosophicalCommitmentsDisplay result={commitmentsState.data} terminologyPreference={terminologyPreference} />
          )}
        </div>
      )}

      {/* Citation Audit */}
      <div class="rounded-xl border border-sky-200 bg-white p-6">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
          <LabelWithTooltip label="citationAudit" preference={terminologyPreference} />
        </h2>
        {!hasActiveSubscription ? (
          <CitationUpsell />
        ) : (
          <>
            {citationState.status === 'idle' && null}
            {citationState.status === 'loading' && (
              <SectionLoading label="Fetching cited sources and analysing each claim — this can take 60–90 seconds for drafts with several citations." />
            )}
            {citationState.status === 'error' && (
              <SectionError code={citationState.code} message={citationState.message} />
            )}
            {citationState.status === 'done' && (
              <CitationAuditDisplay
                result={citationState.data}
                documentId={docId}
                versionId={versionId}
                initialActions={initialActions}
                terminologyPreference={terminologyPreference}
              />
            )}
          </>
        )}
      </div>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  if (!showResults) {
    // Single-column layout — no results yet
    return (
      <div class="space-y-6">
        {inputSection}
        {/* Upsell shown before first run when not subscribed */}
        {!hasActiveSubscription && (
          <>
            <div class="rounded-xl border border-violet-200 bg-white p-6">
              <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
                <LabelWithTooltip label="counterarguments" preference={terminologyPreference} />
              </h2>
              <CounterargUpsell />
            </div>
            <div class="rounded-xl border border-sky-200 bg-white p-6">
              <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">
                <LabelWithTooltip label="citationAudit" preference={terminologyPreference} />
              </h2>
              <CitationUpsell />
            </div>
          </>
        )}
      </div>
    );
  }

  // Two-column layout — results visible
  return (
    <div class="space-y-6">
      {/* SummaryToolbar — full width above columns */}
      {auditState.status === 'done' && (
        <SummaryToolbar result={auditState.data} draftText={draft} />
      )}

      <div class="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left column — input */}
        <div class="w-full lg:w-[58%] space-y-6">
          {inputSection}
        </div>

        {/* Right column — results (sticky) */}
        <div class="w-full lg:w-[42%] space-y-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
          {resultsSection}
        </div>
      </div>
    </div>
  );
}
