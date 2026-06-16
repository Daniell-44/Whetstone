import { useState, useCallback, useEffect } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import type { CounterargumentResult } from '../../lib/counterargument';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import type { PhilosophicalCommitmentsResult } from '../../../functions/_lib/philosophical-commitments/types';
import type { CitationAuditResult } from '../../../functions/_lib/citation-audit/types';
import type { EvidenceWeightedResult } from '../../../functions/_lib/evidence-weighted/types';
import type { PresuppositionResult } from '../../../functions/_lib/presupposition/types';
import type { RhetoricalModeResult } from '../../../functions/_lib/rhetorical-mode/types';
import type { EpistemicHumilityResult } from '../../../functions/_lib/epistemic-humility/types';
import type { DisagreementEngagementResult } from '../../../functions/_lib/disagreement-engagement/types';
import type { StructuralIncentiveResult } from '../../../functions/_lib/structural-incentive/types';
import EvidenceWeightedDisplay from '../evidence/EvidenceWeightedDisplay';
import PresuppositionDisplay from '../presupposition/PresuppositionDisplay';
import RhetoricalModeDisplay from '../rhetorical-mode/RhetoricalModeDisplay';
import EpistemicHumilityDisplay from '../epistemic-humility/EpistemicHumilityDisplay';
import DisagreementEngagementDisplay from '../disagreement-engagement/DisagreementEngagementDisplay';
import StructuralIncentiveDisplay from '../structural-incentive/StructuralIncentiveDisplay';
import GoalSelector from './GoalSelector';
import LiveStats from './LiveStats';
import HighlightedDraft from './HighlightedDraft';
import HeatmapDraft from './HeatmapDraft';
import MobileFindingsSheet from './MobileFindingsSheet';
import SamplePicker from './SamplePicker';
import { totalFindingCount, argumentScore } from '../../lib/audit';
import { SAMPLES, sampleSignature, type Sample } from '../../data/samples';
import type { Audience, Intent } from '../../../functions/_lib/audit/goals';
import AuditResults from '../audit/AuditResults';
import CounterargumentResultDisplay from './CounterargumentResultDisplay';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import PhilosophicalCommitmentsDisplay from '../commitments/PhilosophicalCommitmentsDisplay';
import CitationAuditDisplay from '../citation-audit/CitationAuditDisplay';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import type { TerminologyPreference } from '../../lib/labels';
import SummaryToolbar from '../audit/SummaryToolbar';
import { track } from '../../lib/analytics/track';

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

type EvidenceApiResponse =
  | { ok: true;  result: EvidenceWeightedResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type PresupApiResponse =
  | { ok: true;  result: PresuppositionResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type RhetApiResponse =
  | { ok: true;  result: RhetoricalModeResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type HumilityApiResponse =
  | { ok: true;  result: EpistemicHumilityResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type DisagreeApiResponse =
  | { ok: true;  result: DisagreementEngagementResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type StructuralIncentiveApiResponse =
  | { ok: true;  result: StructuralIncentiveResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CHARS = 50;
const MAX_CHARS = 10_000;

// Threshold for treating an edited sample as a new draft (signature mismatch threshold)
const SAMPLE_DIRTY_CHAR_THRESHOLD = 50;

const AUDIT_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:  "You've reached the daily audit limit. Come back tomorrow.",
  INVALID_INPUT: 'Please check your input and try again.',
  // AUDIT_FAILED intentionally omitted - fall through to show the server's actual error message
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
// LensButton - for on-demand deeper lenses. Compact pill that shows running
// state. Disabled while loading; tappable again after error.
// ---------------------------------------------------------------------------

function LensButton({
  label,
  status,
  onClick,
}: {
  label:   string;
  status:  'idle' | 'loading' | 'done' | 'error';
  onClick: () => void;
}) {
  const isLoading = status === 'loading';
  const isDone    = status === 'done';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading || isDone}
      class={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors text-left
        ${isDone     ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-default' :
          isLoading  ? 'bg-indigo-50  border-indigo-200  text-indigo-500  cursor-wait'    :
                       'bg-white      border-gray-200    text-gray-700    hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700'}`}
    >
      {isLoading ? `${label}…` : isDone ? `✓ ${label}` : label}
    </button>
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
  const [isEditing, setIsEditing] = useState(true);
  const [activeFindingKey, setActiveFindingKey] = useState<string | null>(null);
  const [draftViewMode, setDraftViewMode] = useState<'highlights' | 'heatmap'>('highlights');
  const [audience, setAudience]   = useState<Audience>('general');
  const [intent, setIntent]       = useState<Intent>('persuade');
  // Goals the last analysis actually ran with - used to flag when the current
  // audience/intent differ so the user can re-analyse (we don't auto-rerun).
  const [lastRunGoals, setLastRunGoals] = useState<{ audience: Audience; intent: Intent } | null>(null);

  // Sample-loading state - tracks whether the current draft was loaded from a
  // pre-cached sample and whether the user has meaningfully edited it.
  // If unedited (signature matches), we don't persist or burn API credits.
  const [loadedSample, setLoadedSample]               = useState<Sample | null>(null);
  const [loadedSampleSignature, setLoadedSampleSig]   = useState<string | null>(null);
  const [samplePending, setSamplePending]             = useState(false);
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
  const [evidenceState, setEvidenceState] = useState<SectionState<EvidenceWeightedResult>>({ status: 'idle' });
  const [presupState,   setPresupState]   = useState<SectionState<PresuppositionResult>>({ status: 'idle' });
  const [rhetState,     setRhetState]     = useState<SectionState<RhetoricalModeResult>>({ status: 'idle' });
  const [humilityState, setHumilityState] = useState<SectionState<EpistemicHumilityResult>>({ status: 'idle' });
  const [disagreeState, setDisagreeState] = useState<SectionState<DisagreementEngagementResult>>({ status: 'idle' });
  const [siState,       setSiState]       = useState<SectionState<StructuralIncentiveResult>>({ status: 'idle' });

  const charCount   = draft.length;
  const canSubmit   = !isRunning && charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const showResults = auditState.status !== 'idle' || extractionState.status !== 'idle' || (hasActiveSubscription && (counterargState.status !== 'idle' || commitmentsState.status !== 'idle' || citationState.status !== 'idle'));

  // Update tab title with finding count
  const findingCount = auditState.status === 'done'
    ? auditState.data.namedFallacies.length
      + auditState.data.loadedLanguage.length
      + auditState.data.keyTermScrutiny.length
      + auditState.data.referentChecks.length
      + auditState.data.falsifiabilityChecks.length
      + auditState.data.modalScopeChecks.length
      + auditState.data.toulmin.unstatedWarrants.length
    : 0;

  if (typeof document !== 'undefined') {
    document.title = findingCount > 0
      ? `(${findingCount}) Creator Studio - The Whetstone`
      : 'Creator Studio - The Whetstone';
  }

  // Ctrl/Cmd+Enter to analyse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit) void handleAnalyse();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [canSubmit]);

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
    setEvidenceState({ status: 'idle' });
    setLoadedSample(null);
    setLoadedSampleSig(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('doc');
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Load a sample: populate textarea, then show cached results after a short
  // delay (~2-3s) to mirror real analysis timing. No document is created, no
  // API call is made. Editing past the dirty threshold converts it to a real
  // draft on next "Analyse" - preserving the pedagogical demo while letting
  // the user iterate freely.
  const handleLoadSample = useCallback(async (sample: Sample) => {
    setSamplePending(true);
    setLoadedSample(sample);
    setLoadedSampleSig(sampleSignature(sample.text));
    setDraft(sample.text);
    setTitle(`${sample.shortLabel} - sample`);
    setActiveFindingKey(null);

    // Reset any prior results
    setAuditState({ status: 'loading' });
    setExtractionState({ status: 'loading' });
    if (hasActiveSubscription) {
      setCounterargState({ status: 'idle' });
      setCommitmentsState({ status: 'idle' });
      setCitationState({ status: 'idle' });
    }

    // Artificial delay so it feels like a real analysis (~2.4s)
    await new Promise(r => setTimeout(r, 2400));

    setAuditState({      status: 'done', data: sample.cached.audit });
    setExtractionState({ status: 'done', data: sample.cached.extraction });
    setSamplePending(false);
    setIsEditing(false); // switch to highlighted-draft review mode
  }, [hasActiveSubscription]);

  // Has the user meaningfully edited the loaded sample?
  const isSampleDirty = (() => {
    if (!loadedSample || !loadedSampleSignature) return true; // not a sample → treat as real draft
    if (draft === loadedSample.text) return false;
    const lenDiff = Math.abs(draft.length - loadedSample.text.length);
    return lenDiff > SAMPLE_DIRTY_CHAR_THRESHOLD;
  })();

  const handleAnalyse = useCallback(async () => {
    if (!canSubmit) return;
    const text = draft;

    // If a sample is loaded and unedited, the cached results are already in state.
    // No document creation, no API call. Just switch to highlighted review mode.
    if (loadedSample && !isSampleDirty) {
      setIsEditing(false);
      return;
    }

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
    // Free tier: audit + extraction + the click-to-run deeper lenses.
    // Pro tier auto-runs the expensive Pro-model engines (counterargument,
    // commitments, citation). This keeps free-tier cost bounded - the Pro
    // models only fire for paying users.
    setExtractionState({ status: 'loading' });
    setAuditState({ status: 'loading' });
    setLastRunGoals({ audience, intent });  // record goals this run used
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
      if (extractionDone && auditDone && counterargDone && commitmentsDone && citationDone) {
        setIsRunning(false);
        setIsEditing(false); // Switch to highlighted view
      }
    }

    const versionPath = `/api/documents/${currentDocId}/versions/${currentVersionId}`;

    fetch(`${versionPath}/extraction`, { method: 'POST' })
      .then(r => r.json() as Promise<ExtractionApiResponse>)
      .then(data => {
        if (data.ok) {
          setExtractionState({ status: 'done', data: data.extraction });

          // Fire evidence-weighted assessment for empirical_contested claims (subscription only)
          if (hasActiveSubscription) {
            const empiricalClaims = data.extraction.statements
              .filter(s => s.claimType === 'empirical_contested' || s.claimType === 'empirical_uncontested')
              .map(s => ({ id: s.id, text: s.text, claimType: s.claimType }));
            if (empiricalClaims.length > 0) {
              setEvidenceState({ status: 'loading' });
              fetch('/api/evidence-weighted', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claims: empiricalClaims }),
              })
                .then(r => r.json() as Promise<EvidenceApiResponse>)
                .then(d => {
                  if (d.ok) setEvidenceState({ status: 'done', data: d.result });
                  else setEvidenceState({ status: 'error', code: d.error.code, message: d.error.message });
                })
                .catch(() => setEvidenceState({ status: 'error', code: 'NETWORK', message: 'Evidence check failed.' }));
            }
          }
        } else {
          const code = data.error.code;
          setExtractionState({ status: 'error', code, message: EXTRACTION_ERROR_MESSAGES[code] ?? data.error.message });
        }
      })
      .catch(() => setExtractionState({ status: 'error', code: 'NETWORK', message: 'Network error - check your connection.' }))
      .finally(() => { extractionDone = true; checkDone(); });

    fetch(`${versionPath}/audit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ audience, intent }),
    })
      .then(r => r.json() as Promise<AuditApiResponse>)
      .then(data => {
        if (data.ok) {
          setAuditState({ status: 'done', data: data.audit });
        } else {
          const code = data.error.code;
          setAuditState({ status: 'error', code, message: AUDIT_ERROR_MESSAGES[code] ?? data.error.message });
        }
      })
      .catch(() => setAuditState({ status: 'error', code: 'NETWORK', message: 'Network error - check your connection.' }))
      .finally(() => { auditDone = true; checkDone(); });

    // Counterargument, commitments + citation are Pro-tier (Pro-model / external
    // fetch cost). They auto-fire only for subscribers; free users see the
    // upsell panel pointing to Studio Pro.
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
        .catch(() => setCounterargState({ status: 'error', code: 'NETWORK', message: 'Network error - check your connection.' }))
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
        .catch(() => setCommitmentsState({ status: 'error', code: 'NETWORK', message: 'Network error - check your connection.' }))
        .finally(() => { commitmentsDone = true; checkDone(); });

      // Citation audit - external URL fetching costs.
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
        .catch(() => setCitationState({ status: 'error', code: 'NETWORK', message: 'Network error - check your connection.' }))
        .finally(() => { citationDone = true; checkDone(); });
    }
  }, [draft, docId, versionId, lastSavedContent, title, canSubmit, hasActiveSubscription]);

  // ---------------------------------------------------------------------------
  // runLens - on-demand deeper-lens caller.
  // Each lens hits its own endpoint with the current draft text. Subscription
  // and rate-limiting are enforced server-side; we just dispatch.
  // ---------------------------------------------------------------------------

  type LensName =
    | 'presupposition'
    | 'rhetorical-mode'
    | 'epistemic-humility'
    | 'disagreement-engagement'
    | 'structural-incentive';

  type AnyLensResponse =
    | PresupApiResponse
    | RhetApiResponse
    | HumilityApiResponse
    | DisagreeApiResponse
    | StructuralIncentiveApiResponse;

  const runLens = useCallback(async (
    lens:   LensName,
    text:   string,
    setter: (s: SectionState<any>) => void,
  ) => {
    setter({ status: 'loading' });

    // Map lens name to analytics event name
    const startedEvent =
      lens === 'presupposition'         ? 'presupposition_requested' :
      lens === 'rhetorical-mode'        ? 'rhetorical_mode_requested' :
      lens === 'epistemic-humility'     ? 'epistemic_humility_requested' :
      lens === 'disagreement-engagement'? 'disagreement_engagement_requested' :
                                          'structural_incentive_requested';
    track(startedEvent as any, { surface: 'studio' });

    try {
      const res = await fetch(`/api/${lens}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });
      const data = await res.json() as AnyLensResponse;
      if (data.ok) {
        setter({ status: 'done', data: data.result });
        // Fire completion event with lens-specific metadata where useful
        const r = data.result as any;
        if (lens === 'presupposition') {
          track('presupposition_requested', { surface: 'studio_done', finding_count: r.presuppositions?.length ?? 0 });
        } else if (lens === 'rhetorical-mode') {
          track('rhetorical_mode_requested', { surface: 'studio_done', dominant_appeal: r.dominantAppeal ?? 'unknown' });
        } else if (lens === 'epistemic-humility') {
          track('epistemic_humility_requested', { surface: 'studio_done', verdict: r.overallVerdict ?? 'unknown' });
        } else if (lens === 'disagreement-engagement') {
          track('disagreement_engagement_requested', { surface: 'studio_done', verdict: r.overallVerdict ?? 'unknown' });
        } else if (lens === 'structural-incentive') {
          track('structural_incentive_requested', { surface: 'studio_done', alignment_count: r.alignments?.length ?? 0 });
        }
      } else {
        setter({ status: 'error', code: data.error.code, message: data.error.message });
      }
    } catch {
      setter({ status: 'error', code: 'NETWORK', message: 'Network error - check your connection.' });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Input section (always visible)
  // ---------------------------------------------------------------------------

  const inputSection = (
    <div class="flex flex-col flex-1 gap-3">
      {/* Document title + actions - wraps on mobile so buttons don't squeeze */}
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <input
          type="text"
          value={title}
          onInput={e => setTitle((e.target as HTMLInputElement).value)}
          onBlur={handleTitleBlur}
          maxLength={200}
          placeholder="Untitled draft"
          disabled={isRunning}
          class="w-full sm:flex-1 sm:w-auto rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition-colors disabled:opacity-60"
        />
        {docId && (
          <a
            href={`/creator/documents/${docId}/versions`}
            class="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
          >
            History
          </a>
        )}
        {hasActiveSubscription && (
          <button
            type="button"
            onClick={handleNewDraft}
            disabled={isRunning}
            class="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-40"
          >
            New draft
          </button>
        )}
      </div>

      {/* Cached sample banner */}
      {loadedSample && !isSampleDirty && (
        <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <span class="text-base shrink-0">📚</span>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-amber-800">
              Pre-cached sample · {loadedSample.shortLabel}
            </p>
            <p class="text-[11px] text-amber-700 leading-snug mt-0.5">
              This argument contains: {loadedSample.failureModes.join(', ')}. Edit the text or pick a new example to dismiss.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewDraft}
            class="shrink-0 text-[11px] text-amber-700 hover:text-amber-900 font-medium underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Sample-loading status (artificial delay) */}
      {samplePending && (
        <div class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center">
          <p class="text-xs font-medium text-indigo-700">Loading cached analysis…</p>
        </div>
      )}

      {/* Goal selector */}
      <GoalSelector
        audience={audience}
        intent={intent}
        onAudienceChange={setAudience}
        onIntentChange={setIntent}
        disabled={isRunning}
      />

      {/* Audience/intent changed since the last run - offer a re-analyse
         (we deliberately don't auto-rerun; these change the model's judgement). */}
      {showResults && !isRunning && lastRunGoals &&
        (audience !== lastRunGoals.audience || intent !== lastRunGoals.intent) && (
        <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center justify-between gap-3">
          <p class="text-xs text-amber-800">Audience or intent changed. The analysis below still reflects the previous settings.</p>
          <button
            type="button"
            onClick={handleAnalyse}
            class="shrink-0 text-xs font-semibold rounded-md bg-amber-500 text-white px-3 py-1.5 hover:bg-amber-600 transition-colors"
          >
            Re-analyse
          </button>
        </div>
      )}

      {/* Draft display - either textarea (editing) or highlighted view (reviewing) */}
      {!isEditing && showResults && auditState.status === 'done' ? (
        /* Highlighted review mode - fills vertical space */
        <div class="flex flex-col flex-1 space-y-2">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <p class="text-xs text-gray-400">
              {draftViewMode === 'highlights'
                ? 'Click a highlight to jump to the finding. Hover for details.'
                : 'Hover for finding details. Click any colour to jump to the top finding. Darker = more density.'}
            </p>
            <div class="flex items-center gap-3">
              {/* View toggle */}
              <div class="flex gap-0.5 p-0.5 bg-gray-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setDraftViewMode('highlights')}
                  class={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    draftViewMode === 'highlights'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Highlights
                </button>
                <button
                  type="button"
                  onClick={() => setDraftViewMode('heatmap')}
                  class={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    draftViewMode === 'heatmap'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Heatmap
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setIsEditing(true); setActiveFindingKey(null); }}
                class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                ✎ Edit draft
              </button>
            </div>
          </div>
          <div class="flex-1" style={{ minHeight: 'calc(100vh - 18rem)' }}>
            {draftViewMode === 'highlights' ? (
              <HighlightedDraft
                text={draft}
                audit={auditState.data}
                activeFindingKey={activeFindingKey}
                onHighlightClick={(key) => {
                  setActiveFindingKey(key);
                  const el = document.querySelector(`[data-finding-key="${key}"]`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />
            ) : (
              <HeatmapDraft
                text={draft}
                audit={auditState.data}
                onFindingClick={(key) => {
                  setActiveFindingKey(key);
                  const el = document.querySelector(`[data-finding-key="${key}"]`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => { setIsEditing(true); }}
            class="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Revise & re-analyse
          </button>
        </div>
      ) : (
        /* Editing mode - textarea IS the surface, no wrapper box */
        <div class="flex flex-col flex-1 space-y-2">
          <div class="flex-1 flex flex-col">
            <textarea
              value={draft}
              onInput={e => setDraft((e.target as HTMLTextAreaElement).value)}
              placeholder="Paste your draft here - any argumentative text, essay, or opinion piece (50-10,000 characters)."
              disabled={isRunning}
              data-tour-anchor="studio-textarea"
              class="w-full flex-1 min-h-[50vh] sm:min-h-[50vh] xl:min-h-[calc(100vh-22rem)] border border-gray-200 bg-white px-4 py-3 sm:px-5 sm:py-4 text-base sm:text-sm text-gray-800 placeholder-gray-400 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 focus:border-amber-300 transition-colors disabled:opacity-60"
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
                  ? 'Too long - please trim to 10,000 characters'
                  : ''}
              </span>
              <span class={charCount > MAX_CHARS ? 'text-red-500' : 'text-gray-400'}>
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </span>
            </div>
            <LiveStats text={draft} />
          </div>

          <div class="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleAnalyse}
              disabled={!canSubmit}
              data-tour-anchor="studio-analyse"
              class={`flex-1 py-2.5 px-6 rounded-lg text-sm font-semibold transition-colors ${
                canSubmit
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isRunning ? 'Analysing…' : 'Analyse my draft'}
            </button>
            {!draft.trim() && !isRunning && (
              <SamplePicker onPick={(s) => { void handleLoadSample(s); }} disabled={isRunning || samplePending} />
            )}
          </div>
          {canSubmit && !isRunning && (
            <p class="text-[10px] text-gray-300 text-center">⌘/Ctrl + Enter</p>
          )}
          {isRunning && hasActiveSubscription && (
            <p class="text-xs text-center text-gray-400">
              ~60-90s - fetching cited sources and finding opposing cases takes longer than a simple audit.
            </p>
          )}
        </div>
      )}
    </div>
  );

  // (Results are now distributed across left and right sidebars above)

  // ---------------------------------------------------------------------------
  // Left sidebar: structure + goals + document info
  // ---------------------------------------------------------------------------

  const leftSidebar = showResults ? (
    <div class="space-y-4">
      {/* Summary stats */}
      {auditState.status === 'done' && (
        <div data-tour-anchor="studio-share">
          <SummaryToolbar result={auditState.data} draftText={draft} draftTitle={title} />
        </div>
      )}

      {/* Argument skeleton */}
      {extractionState.status !== 'idle' && (
        <div class="rounded-lg border border-emerald-200 bg-white p-4">
          <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Argument Skeleton</h3>
          {extractionState.status === 'loading' && <SectionLoading label="Mapping structure…" />}
          {extractionState.status === 'error' && <SectionError code={extractionState.code} message={extractionState.message} />}
          {extractionState.status === 'done' && (
            <ArgumentExtraction
              result={extractionState.data}
              terminologyPreference={terminologyPreference}
              evidenceAssessments={evidenceState.status === 'done' ? evidenceState.data.assessments : undefined}
            />
          )}
        </div>
      )}

      {/* Framework Check - free tier */}
      {commitmentsState.status !== 'idle' && (
        <div class="rounded-lg border border-purple-200 bg-white p-4">
          <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            <LabelWithTooltip label="commitments" preference={terminologyPreference} />
          </h3>
          {commitmentsState.status === 'loading' && <SectionLoading label="Detecting frameworks…" />}
          {commitmentsState.status === 'error' && <SectionError code={commitmentsState.code} message={commitmentsState.message} />}
          {commitmentsState.status === 'done' && (
            <PhilosophicalCommitmentsDisplay result={commitmentsState.data} terminologyPreference={terminologyPreference} />
          )}
        </div>
      )}

      {/* Counterarguments */}
      <div class="rounded-lg border border-violet-200 bg-white p-4">
        <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
          <LabelWithTooltip label="counterarguments" preference={terminologyPreference} />
        </h3>
        {/* Counterarguments are now free - runs on every audit. */}
        {counterargState.status === 'loading' && <SectionLoading label="Finding opposing cases…" />}
        {counterargState.status === 'error' && <SectionError code={counterargState.code} message={counterargState.message} />}
        {counterargState.status === 'done' && (
          <CounterargumentResultDisplay result={counterargState.data} terminologyPreference={terminologyPreference} />
        )}
      </div>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // Right sidebar: audit findings + citation audit
  // ---------------------------------------------------------------------------

  const rightSidebar = showResults ? (
    <div class="space-y-4">
      {/* Audit findings */}
      <div data-tour-anchor="studio-findings" class="rounded-lg border border-gray-200 bg-white p-4">
        <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Findings</h3>
        {auditState.status === 'loading' && <SectionLoading label="Running audit…" />}
        {auditState.status === 'error' && <SectionError code={auditState.code} message={auditState.message} />}
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

      {/* Citation Audit */}
      <div class="rounded-lg border border-sky-200 bg-white p-4">
        <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
          <LabelWithTooltip label="citationAudit" preference={terminologyPreference} />
        </h3>
        {!hasActiveSubscription ? <CitationUpsell /> : (
          <>
            {citationState.status === 'loading' && <SectionLoading label="Checking sources…" />}
            {citationState.status === 'error' && <SectionError code={citationState.code} message={citationState.message} />}
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

      {/* Evidence-Weighted Likelihood (Studio Pro) */}
      {hasActiveSubscription && evidenceState.status !== 'idle' && (
        <div class="rounded-lg border border-emerald-200 bg-white p-4">
          <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Evidence Check
          </h3>
          {evidenceState.status === 'loading' && <SectionLoading label="Searching academic literature…" />}
          {evidenceState.status === 'error' && <SectionError code={evidenceState.code} message={evidenceState.message} />}
          {evidenceState.status === 'done' && (
            <EvidenceWeightedDisplay result={evidenceState.data} />
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* On-demand deeper lenses (free tier). Fire when the user clicks;   */}
      {/* cached per draft via component state. All Flash-tier - cheap per  */}
      {/* call. Free until users come online and we calibrate.              */}
      {/* ----------------------------------------------------------------- */}
      {auditState.status === 'done' && (
        <div data-tour-anchor="studio-deeper-lenses" class="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Deeper lenses</h3>
            <span class="text-[10px] text-gray-400">click to run</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <LensButton
              label="Presuppositions"
              status={presupState.status}
              onClick={() => void runLens('presupposition', draft, setPresupState)}
            />
            <LensButton
              label="Rhetorical mode"
              status={rhetState.status}
              onClick={() => void runLens('rhetorical-mode', draft, setRhetState)}
            />
            <LensButton
              label="Epistemic humility"
              status={humilityState.status}
              onClick={() => void runLens('epistemic-humility', draft, setHumilityState)}
            />
            <LensButton
              label="Engagement quality"
              status={disagreeState.status}
              onClick={() => void runLens('disagreement-engagement', draft, setDisagreeState)}
            />
          </div>

          {/* Cui bono - sharp-edged lens, visually separated + always-shown caveat in display */}
          <div class="border-t border-gray-100 pt-3">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[10px] font-semibold uppercase tracking-widest text-amber-700">
                Structural-incentive analysis
              </p>
              <p class="text-[10px] text-gray-400 italic">structural, not personal</p>
            </div>
            <p class="text-[11px] text-gray-500 leading-relaxed mb-2">
              Whose positions in a political economy benefit if a reader accepts this framing.
              Interest-aligned arguments can still be correct - this lens surfaces a question, not a verdict.
            </p>
            <LensButton
              label="Structural incentives"
              status={siState.status}
              onClick={() => void runLens('structural-incentive', draft, setSiState)}
            />
          </div>

          {presupState.status === 'loading' && <SectionLoading label="Surfacing presuppositions…" />}
          {presupState.status === 'error' && <SectionError code={presupState.code} message={presupState.message} />}
          {presupState.status === 'done' && (
            <div>
              <h4 class="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 mb-2">Presuppositions</h4>
              <PresuppositionDisplay result={presupState.data} />
            </div>
          )}

          {rhetState.status === 'loading' && <SectionLoading label="Analysing rhetorical balance…" />}
          {rhetState.status === 'error' && <SectionError code={rhetState.code} message={rhetState.message} />}
          {rhetState.status === 'done' && (
            <div>
              <h4 class="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 mb-2">Rhetorical mode</h4>
              <RhetoricalModeDisplay result={rhetState.data} />
            </div>
          )}

          {humilityState.status === 'loading' && <SectionLoading label="Checking certainty calibration…" />}
          {humilityState.status === 'error' && <SectionError code={humilityState.code} message={humilityState.message} />}
          {humilityState.status === 'done' && (
            <div>
              <h4 class="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 mb-2">Epistemic humility</h4>
              <EpistemicHumilityDisplay result={humilityState.data} />
            </div>
          )}

          {disagreeState.status === 'loading' && <SectionLoading label="Evaluating engagement with opposing positions…" />}
          {disagreeState.status === 'error' && <SectionError code={disagreeState.code} message={disagreeState.message} />}
          {disagreeState.status === 'done' && (
            <div>
              <h4 class="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 mb-2">Engagement quality</h4>
              <DisagreementEngagementDisplay result={disagreeState.data} />
            </div>
          )}

          {siState.status === 'loading' && <SectionLoading label="Mapping structural interest alignment…" />}
          {siState.status === 'error' && <SectionError code={siState.code} message={siState.message} />}
          {siState.status === 'done' && (
            <div>
              <h4 class="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-2">Structural-incentive analysis</h4>
              <StructuralIncentiveDisplay result={siState.data} />
            </div>
          )}
        </div>
      )}
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  if (!showResults) {
    // Centered single-column - before first audit
    return (
      <div class="max-w-3xl mx-auto space-y-6">
        {inputSection}
        {!hasActiveSubscription && (
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="rounded-lg border border-violet-200 bg-white p-4">
              <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                <LabelWithTooltip label="counterarguments" preference={terminologyPreference} />
              </h3>
              <CounterargUpsell />
            </div>
            <div class="rounded-lg border border-sky-200 bg-white p-4">
              <h3 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                <LabelWithTooltip label="citationAudit" preference={terminologyPreference} />
              </h3>
              <CitationUpsell />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Compute counts for the mobile bottom sheet tabs
  const findingsCount = auditState.status === 'done' ? totalFindingCount(auditState.data) : 0;
  const score = auditState.status === 'done' ? argumentScore(auditState.data) : null;

  // Mobile bottom-sheet tabs
  const mobileTabs = showResults ? [
    { id: 'findings',  label: 'Findings',        count: findingsCount, body: rightSidebar },
    { id: 'structure', label: 'Structure',       body: leftSidebar },
  ] : [];

  const scoreBadge = score !== null ? (
    <span class="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-white/20">{score}</span>
  ) : null;

  // Three-panel Grammarly-style layout on desktop; single-column + bottom sheet on mobile
  return (
    <>
      <div class="flex flex-col xl:flex-row gap-4 items-start" style={{ minHeight: 'calc(100vh - 6rem)' }}>

        {/* Left sidebar - hidden on mobile (moved to bottom sheet) */}
        <div class="hidden xl:block w-full xl:w-[22%] xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto space-y-4 xl:order-1">
          {leftSidebar}
        </div>

        {/* Center - always visible. Full width on mobile. */}
        <div class="w-full xl:w-[46%] xl:min-h-[calc(100vh-6rem)] xl:order-2 flex flex-col">
          {inputSection}
        </div>

        {/* Right sidebar - hidden on mobile (moved to bottom sheet) */}
        <div class="hidden xl:block w-full xl:w-[32%] xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto space-y-4">
          {rightSidebar}
        </div>

      </div>

      {/* Mobile bottom-sheet for findings + structure (only after analysis) */}
      {showResults && (
        <MobileFindingsSheet
          tabs={mobileTabs}
          totalFindings={findingsCount}
          scoreBadge={scoreBadge}
        />
      )}
    </>
  );
}
