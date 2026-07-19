import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
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
import { applyContextualSeverity } from '../../../functions/_lib/audit/contextual-severity';
import { SAMPLES, sampleSignature, type Sample } from '../../data/samples';
import type { Audience, Intent } from '../../../functions/_lib/audit/goals';
import AuditResults from '../audit/AuditResults';
import CounterargumentResultDisplay from './CounterargumentResultDisplay';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import ToulminCallouts from '../audit/ToulminCallouts';
import PhilosophicalCommitmentsDisplay from '../commitments/PhilosophicalCommitmentsDisplay';
import CitationAuditDisplay from '../citation-audit/CitationAuditDisplay';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import type { TerminologyPreference } from '../../lib/labels';
import SummaryToolbar from '../audit/SummaryToolbar';
import { MIN_CHARS, MAX_CHARS } from '../tool/constants';
import { runEngine, runLens as runLensShared, type SectionState, type LensName } from '../tool/engine';
import { soloPrice } from '../../lib/pricing';
import { STUDIO_ANALYSIS_DONE_EVENT } from './analysis-events';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// MIN_CHARS / MAX_CHARS now come from ../tool/constants (shared with the Reader).

// Threshold for treating an edited sample as a new draft (signature mismatch threshold)
const SAMPLE_DIRTY_CHAR_THRESHOLD = 50;

const AUDIT_ERROR_MESSAGES: Record<string, string> = {
  // Studio audits are capped monthly (PAID_MONTHLY_AUDIT_BLOCK), not daily —
  // "come back tomorrow" would show the same wrong message for weeks. (The Pro
  // sub-engines below ARE daily-capped, so their copy stays.)
  RATE_LIMITED:  "You've reached your monthly Studio audit limit. See usage in Account.",
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
    <div class="rounded-xl border border-accent-support/30 bg-accent-support/5 p-6 text-center space-y-4">
      <p class="text-xs font-mono font-semibold uppercase tracking-widest text-accent-support">Studio Pro feature</p>
      <p class="text-sm text-ink leading-relaxed max-w-sm mx-auto">
        Source Match fetches every cited URL in your draft and checks whether the source
        actually supports the claim. Subscribe to unlock it.
      </p>
      <a
        href="/pricing"
        class="inline-block rounded-xl bg-accent-support px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent transition-colors"
      >
        See plans →
      </a>
    </div>
  );
}

function CounterargUpsell() {
  return (
    <div class="rounded-xl border border-accent-support/30 bg-accent-support/5 p-6 text-center space-y-4">
      <p class="text-xs font-mono font-semibold uppercase tracking-widest text-accent-support">Studio Pro feature</p>
      <p class="text-sm text-ink leading-relaxed max-w-sm mx-auto">
        The opposing-cases engine surfaces the strongest objections your draft fails
        to engage with. Part of Studio, {soloPrice}.
      </p>
      <a
        href="/pricing"
        class="inline-block rounded-xl bg-accent-support px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent transition-colors"
      >
        See plans →
      </a>
    </div>
  );
}

function SectionError({ code, message }: { code: string; message: string }) {
  if (code === 'UNAUTHORIZED') {
    return (
      <div class="rounded-xl bg-accent/5 border-l-2 border-accent p-4 text-sm text-accent">
        Your session has expired.{' '}
        <a href="/login?returnTo=/creator/studio" class="underline font-medium">
          Sign in again →
        </a>
      </div>
    );
  }
  return (
    <div class="rounded-xl bg-accent/5 border-l-2 border-accent p-4">
      <p class="text-sm text-accent">{message}</p>
    </div>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div class="rounded-xl bg-accent/5 border border-accent/20 p-5 text-center">
      <p class="text-sm text-accent font-medium">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LensButton - for on-demand deeper lenses. A clearly-pressable trigger: a
// leading ▸ run-glyph (→ spinner while running → ✓ when done) plus border,
// pointer cursor, hover fill and a focus ring so it reads unmistakably as a
// button, not a label. Disabled while loading and once done (result shows
// below); tappable again after error.
// ---------------------------------------------------------------------------

function LensButton({
  label,
  status,
  onClick,
  compact = false,
}: {
  label:   string;
  status:  'idle' | 'loading' | 'done' | 'error';
  onClick: () => void;
  /** Smaller footprint for the demoted free-tier lens strip. */
  compact?: boolean;
}) {
  const isLoading = status === 'loading';
  const isDone    = status === 'done';
  const sizing = compact
    ? 'gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md'
    : 'gap-2 w-full text-xs px-3 py-2.5 rounded-lg';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading || isDone}
      aria-label={isDone ? `${label}, done` : isLoading ? `Running ${label}…` : `Run ${label}`}
      class={`group flex items-center ${sizing} font-medium border transition-colors text-left
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${isDone     ? 'bg-factual-bg border-factual/30 text-factual cursor-default' :
          isLoading  ? 'bg-accent/5  border-accent  text-accent  cursor-wait'    :
                       'bg-surface      border-hairline    text-ink    cursor-pointer hover:bg-accent/5 hover:border-accent hover:text-accent'}`}
    >
      {isLoading ? (
        <svg class="shrink-0 w-3.5 h-3.5 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <span class={`shrink-0 text-[13px] leading-none ${isDone ? 'text-factual' : 'text-accent/70 group-hover:text-accent'}`} aria-hidden="true">
          {isDone ? '✓' : '▸'}
        </span>
      )}
      <span class="flex-1">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ProTag - small tier marker on the Pro-differentiated engine panels. Uses
// the drafting blue (accent-support): interaction/Pro colour, never redline.
// ---------------------------------------------------------------------------

function ProTag() {
  return (
    <span class="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-support border border-accent-support/40 rounded-[2px] px-1 py-px">
      Pro
    </span>
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
  initialAnalyzedAt?:           number | null;
  initialActions?:              Record<string, { id: string; action: string; reason?: string | null; updatedAt: number }>;
  terminologyPreference?:       TerminologyPreference;
  // Read → Create bridge (/audit merge): consume a sessionStorage handoff into
  // a fresh editor on mount. Off by default so /creator/studio is unaffected.
  consumeHandoff?:              boolean;
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
  initialAnalyzedAt           = null,
  initialActions              = {},
  terminologyPreference,
  consumeHandoff              = false,
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
  // A reopened draft that already has an audit should land in highlighted-review
  // mode, not the blank textarea — otherwise the inline highlights don't render
  // and clicking a finding card has no span to scroll to. New drafts start in
  // editing mode as before.
  const [isEditing, setIsEditing] = useState(initialAuditResult == null);
  const [analyzedAt, setAnalyzedAt] = useState<number | null>(initialAnalyzedAt);
  // A4 experimental flag (off by default). `?ctxsev=1` re-bands finding
  // severities by argument context for A/B evaluation — never on in production.
  const ctxSev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ctxsev') === '1';
  const [activeFindingKey, setActiveFindingKey] = useState<string | null>(null);
  // Mobile bottom sheet is CONTROLLED so the draft<->findings navigation can
  // choreograph it (open at a card / close then flash the span).
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState('specific');
  // Transient flash on a span when the user jumps to it from a right-hand card.
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const [draftViewMode, setDraftViewMode] = useState<'highlights' | 'heatmap'>('highlights');
  const [audience, setAudience]   = useState<Audience>('general');
  const [intent, setIntent]       = useState<Intent>('analyse');
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

  useEffect(() => {
    document.title = findingCount > 0
      ? `(${findingCount}) Studio - The Whetstone`
      : 'Studio - The Whetstone';
  }, [findingCount]);

  // Read → Create handoff (/audit merge): the Reader's "Work on this text in
  // Create" bridge and the homepage launcher stash text under 'wst_handoff';
  // consume it ONCE into a fresh editor only — never over a loaded document.
  // Mirrors AuditForm's consumption pattern (same key, try/catch, mount-only).
  // Deliberately self-contained with empty deps: `draft` read here is the
  // initial state at mount, which is exactly what the emptiness guard needs.
  useEffect(() => {
    if (!consumeHandoff || initialDocId || draft !== '') return;
    try {
      // sessionStorage is the same-tab path; the localStorage copy (15 min
      // TTL) is the magic-LINK path — sign-in emails open a NEW tab where
      // sessionStorage is empty. Both keys are removed UNCONDITIONALLY (even
      // for a sub-50-char stash) so a stale value can never be silently
      // injected into the Reader textarea by AuditForm's consumer later.
      const fromSession = sessionStorage.getItem('wst_handoff');
      sessionStorage.removeItem('wst_handoff');
      let h = fromSession;
      const rawLs = localStorage.getItem('wst_handoff_ls');
      localStorage.removeItem('wst_handoff_ls');
      if (!h && rawLs) {
        const parsed = JSON.parse(rawLs) as { t?: number; text?: string };
        if (typeof parsed.text === 'string' && typeof parsed.t === 'number' && Date.now() - parsed.t < 15 * 60_000) {
          h = parsed.text;
        }
      }
      if (h && h.length >= 50) setDraft(h);
    } catch { /* storage unavailable / corrupt stash */ }
  }, []);

  // Announce each landing of the audit in 'done' to sibling islands: the
  // onboarding tour's post-analysis act (mounted separately in studio.astro)
  // listens for this. Ref-tracked so only a genuine transition into 'done'
  // fires, not every re-render while the state stays 'done'.
  const prevAuditStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (auditState.status === 'done' && prevAuditStatusRef.current !== 'done') {
      window.dispatchEvent(new CustomEvent(STUDIO_ANALYSIS_DONE_EVENT));
    }
    prevAuditStatusRef.current = auditState.status;
  }, [auditState.status]);

  // Ctrl/Cmd+Enter to analyse. handleAnalyse is read through a ref (assigned
  // every render after it's defined) so the listener always runs the LATEST
  // closure. Keying only on canSubmit re-subscribed the listener only when
  // validity flipped, so edits made afterwards ran a stale handleAnalyse —
  // Cmd+Enter analysed AND persisted old text while the screen showed new text.
  const handleAnalyseRef = useRef<() => void>(() => {});
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit) void handleAnalyseRef.current();
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
    setAnalyzedAt(Date.now());
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

    void runEngine<ArgumentExtractionResult>({
      url:           `${versionPath}/extraction`,
      setter:        setExtractionState,
      pick:          d => d.extraction,
      errorMessages: EXTRACTION_ERROR_MESSAGES,
      onOk: (data) => {
        // Fire evidence-weighted assessment for empirical claims (subscription only)
        if (hasActiveSubscription) {
          const empiricalClaims = (data.extraction as ArgumentExtractionResult).statements
            .filter(s => s.claimType === 'empirical_contested' || s.claimType === 'empirical_uncontested')
            .map(s => ({ id: s.id, text: s.text, claimType: s.claimType }));
          if (empiricalClaims.length > 0) {
            void runEngine<EvidenceWeightedResult>({
              url:            '/api/evidence-weighted',
              body:           { claims: empiricalClaims },
              setter:         setEvidenceState,
              pick:           d => d.result,
              networkMessage: 'Evidence check failed.',
            });
          }
        }
      },
      onSettled: () => { extractionDone = true; checkDone(); },
    });

    void runEngine<AuditResult>({
      url:           `${versionPath}/audit`,
      body:          { audience, intent },
      setter:        setAuditState,
      pick:          d => d.audit,
      errorMessages: AUDIT_ERROR_MESSAGES,
      onSettled:     () => { auditDone = true; checkDone(); },
    });

    // Counterargument, commitments + citation are Pro-tier (Pro-model / external
    // fetch cost). They auto-fire only for subscribers; free users see the
    // upsell panel pointing to Studio Pro.
    if (hasActiveSubscription) {
      void runEngine<CounterargumentResult>({
        url:           `${versionPath}/counterargument`,
        setter:        setCounterargState,
        pick:          d => d.result,
        errorMessages: COUNTERARG_ERROR_MESSAGES,
        onSettled:     () => { counterargDone = true; checkDone(); },
      });

      void runEngine<PhilosophicalCommitmentsResult>({
        url:           `${versionPath}/commitments`,
        setter:        setCommitmentsState,
        pick:          d => d.result,
        errorMessages: COMMITMENTS_ERROR_MESSAGES,
        onSettled:     () => { commitmentsDone = true; checkDone(); },
      });

      // Citation audit - external URL fetching costs. The SERVER persists the
      // result onto the version (documentId/versionId in the body), so a phone
      // locking or the tab suspending mid-run no longer loses Source Match -
      // the old client-side follow-up persist fetch died with the tab.
      void runEngine<CitationAuditResult>({
        url:  '/api/citation-audit',
        body: {
          text,
          documentId: currentDocId ?? undefined,
          versionId:  currentVersionId ?? undefined,
        },
        setter:        setCitationState,
        pick:          d => d.result,
        errorMessages: CITATION_ERROR_MESSAGES,
        onSettled:     () => { citationDone = true; checkDone(); },
      });
    }
    // audience + intent MUST be in deps: without them the memoised callback
    // closed over the goals from a previous render, so "Re-analyse with these
    // settings" ran a full Pro suite against the OLD audience/intent and the
    // stale banner never cleared.
  }, [draft, docId, versionId, lastSavedContent, title, canSubmit, hasActiveSubscription, audience, intent]);

  // Keep the Cmd/Enter listener pointed at the latest handleAnalyse.
  handleAnalyseRef.current = handleAnalyse;

  // ---------------------------------------------------------------------------
  // runLens - on-demand deeper-lens caller (shared plumbing in tool/engine.ts).
  // Subscription and rate-limiting are enforced server-side; we just dispatch.
  // ---------------------------------------------------------------------------

  const runLens = useCallback(async (
    lens:   LensName,
    text:   string,
    setter: (s: SectionState<any>) => void,
  ) => {
    await runLensShared({ lens, text, surface: 'studio', setter, emitDoneEvent: true });
  }, []);

  // ---------------------------------------------------------------------------
  // Two-way navigation between the centre draft and the right-hand finding
  // cards. Both views key findings by the canonical match-key, so a span and
  // its card share one id.
  // ---------------------------------------------------------------------------

  // Below xl the finding cards exist only INSIDE the bottom sheet (which is
  // unmounted until opened), so both navigation directions must choreograph
  // the sheet: highlight tap opens it at the card; card tap closes it, then
  // reveals + flashes the span once the 280ms exit has run. Before this, a
  // highlight tap on a phone silently did nothing and a card tap scrolled a
  // draft hidden behind the scroll-locked sheet.
  const isBelowDesktop = () =>
    typeof window !== 'undefined' && !window.matchMedia('(min-width: 1280px)').matches;

  // Centre -> right: a draft highlight (or heatmap run) was clicked; select it
  // and scroll its card into view (desktop: the sticky rail; mobile: the sheet).
  const handleNavigateToCard = useCallback((key: string) => {
    setActiveFindingKey(key);
    if (isBelowDesktop()) {
      setSheetTab('specific');
      setSheetOpen(true);
      // The sheet's scrollToKey brings the card into view once mounted.
      return;
    }
    // CSS.escape: finding keys embed the quoted span text, which can contain
    // quotes/colons that break a raw attribute selector (returns null → no scroll).
    const el = document.querySelector(`[data-finding-key="${CSS.escape(key)}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Right -> centre: a finding card was clicked; select it, scroll its quote
  // into view in the draft, and flash it briefly.
  const handleNavigateToSpan = useCallback((key: string) => {
    setActiveFindingKey(key);
    const revealAndFlash = () => {
      setFlashKey(key);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashKey(null), 1100);
      const el = document.querySelector(`[data-match-key="${CSS.escape(key)}"]`);
      // behavior:'auto' (instant): smooth scrollIntoView is silently dropped in
      // some environments (verified: it no-ops here while 'auto' scrolls). A
      // jump-to-span is fine instant, and this is reliable everywhere.
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
    };
    if (isBelowDesktop()) {
      // Dismiss the sheet (it scroll-locks the body) before revealing the span.
      setSheetOpen(false);
      window.setTimeout(revealAndFlash, 320);
      return;
    }
    revealAndFlash();
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
          class="w-full sm:flex-1 sm:w-auto rounded-lg border border-hairline bg-surface px-3 py-2.5 text-base sm:text-sm font-medium text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:opacity-60"
        />
        {docId && (
          <a
            href={`/creator/documents/${docId}/versions`}
            class="shrink-0 rounded-xl border border-hairline bg-surface px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-muted hover:text-ink hover:border-hairline transition-colors"
          >
            History
          </a>
        )}
        {hasActiveSubscription && (
          <button
            type="button"
            onClick={handleNewDraft}
            disabled={isRunning}
            class="shrink-0 rounded-xl border border-hairline bg-surface px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm text-muted hover:text-ink hover:border-hairline transition-colors disabled:opacity-40"
          >
            New draft
          </button>
        )}
      </div>

      {/* Cached sample banner */}
      {loadedSample && !isSampleDirty && (
        <div class="rounded-lg border border-hairline bg-paper px-4 py-3 flex items-start gap-3">
          <span class="text-base shrink-0">📚</span>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-ink-strong">
              Pre-cached sample · {loadedSample.shortLabel}
            </p>
            <p class="text-xs text-muted leading-snug mt-0.5">
              This argument contains: {loadedSample.failureModes.join(', ')}. Edit the text or pick a new example to dismiss.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewDraft}
            class="shrink-0 text-xs text-muted hover:text-ink font-medium underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Sample-loading status (artificial delay) */}
      {samplePending && (
        <div class="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-center">
          <p class="text-xs font-medium text-accent">Loading cached analysis…</p>
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
        <div class="rounded-lg border border-hairline bg-paper px-4 py-2.5 flex items-center justify-between gap-3">
          <p class="text-xs text-muted">Audience or intent changed. The analysis below still reflects the previous settings.</p>
          <button
            type="button"
            onClick={handleAnalyse}
            class="shrink-0 text-xs font-semibold rounded-md bg-accent-support text-white px-3 py-1.5 hover:bg-accent transition-colors"
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
            <p class="text-xs text-muted">
              {draftViewMode === 'highlights'
                ? 'Tap or click a highlight to open its finding.'
                : 'Tap or click any colour to jump to the top finding. Darker = more density.'}
            </p>
            <div class="flex items-center gap-3">
              {/* View toggle */}
              <div class="flex gap-0.5 p-0.5 bg-hairline/40 rounded-md">
                <button
                  type="button"
                  onClick={() => setDraftViewMode('highlights')}
                  class={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    draftViewMode === 'highlights'
                      ? 'bg-surface text-ink-strong shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Highlights
                </button>
                <button
                  type="button"
                  onClick={() => setDraftViewMode('heatmap')}
                  class={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    draftViewMode === 'heatmap'
                      ? 'bg-surface text-ink-strong shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Heatmap
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setIsEditing(true); setActiveFindingKey(null); }}
                class="text-xs text-accent-support hover:text-accent font-medium transition-colors"
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
                flashKey={flashKey}
                onHighlightClick={handleNavigateToCard}
              />
            ) : (
              <HeatmapDraft
                text={draft}
                audit={auditState.data}
                onFindingClick={handleNavigateToCard}
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => { setIsEditing(true); }}
            class="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-accent-support text-white hover:bg-accent transition-colors"
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
              class="w-full flex-1 min-h-[50vh] sm:min-h-[50vh] xl:min-h-[calc(100vh-22rem)] border border-hairline bg-surface px-4 py-3 sm:px-5 sm:py-4 text-base sm:text-sm text-ink placeholder-muted leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors disabled:opacity-60"
            />
            <div class="flex justify-between mt-1.5 text-xs">
              <span class={
                charCount > 0 && charCount < MIN_CHARS ? 'text-sev-med'
                : charCount > MAX_CHARS               ? 'text-accent'
                :                                       'text-muted'
              }>
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
            {/* Once the audit is done the sidebar SummaryToolbar shows the same
               stats (including a Grade from its own Flesch-Kincaid pass), so
               rendering both put two Grade values on screen at once. LiveStats
               returns when a new draft or re-analysis leaves 'done'. */}
            {auditState.status !== 'done' && <LiveStats text={draft} />}
          </div>

          <div class="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleAnalyse}
              disabled={!canSubmit}
              data-tour-anchor="studio-analyse"
              class={`flex-1 py-2.5 px-6 rounded-lg text-sm font-semibold transition-colors ${
                canSubmit
                  ? 'bg-accent-support text-white hover:bg-accent'
                  : 'bg-hairline/40 text-muted cursor-not-allowed'
              }`}
            >
              {isRunning ? 'Analysing…' : 'Analyse my draft'}
            </button>
            {!draft.trim() && !isRunning && (
              <SamplePicker onPick={(s) => { void handleLoadSample(s); }} disabled={isRunning || samplePending} />
            )}
          </div>
          {canSubmit && !isRunning && (
            <p class="text-xs text-muted text-center">⌘/Ctrl + Enter</p>
          )}
          {isRunning && hasActiveSubscription && (
            <p class="text-xs text-center text-muted">
              ~60-90s - fetching cited sources and finding opposing cases takes longer than a simple audit.
              The analysis continues on our side, so you can leave and come back to this draft.
            </p>
          )}
        </div>
      )}
    </div>
  );

  // (Results are now distributed across left and right sidebars below)

  // ---------------------------------------------------------------------------
  // Result panels. The split: the LEFT column leads with the summary and the
  // Pro-differentiated engines (counterargument, commitments, citation audit,
  // evidence check), then the skeleton, with the free deeper lenses demoted to
  // a compact strip at the bottom. Span-anchored specifics (findings that map
  // to a quote in the draft) live on the RIGHT. Each panel is defined once
  // here, then composed into the desktop columns and the mobile bottom-sheet
  // tabs below.
  // ---------------------------------------------------------------------------

  // Summary score - pinned to the top of the LEFT column.
  const summaryPanel = auditState.status === 'done' ? (
    <div data-tour-anchor="studio-share" class="space-y-1.5">
      {analyzedAt && (
        <p class="text-xs text-muted">Last analysed {new Date(analyzedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      )}
      <SummaryToolbar result={auditState.data} draftText={draft} draftTitle={title} />
    </div>
  ) : null;

  // Argument skeleton (numbered premises + inference rules). The "weakest link"
  // from the Toulmin audit is folded in here as a flagged callout — the rest of
  // the old Overview panel duplicated the skeleton (central claim + the ★
  // implicit premises that are the hidden assumptions), so it was retired.
  const skeletonPanel = extractionState.status !== 'idle' ? (
    <div class="rounded-lg border border-hairline bg-surface p-4">
      <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Argument Skeleton</h3>
      {extractionState.status === 'loading' && <SectionLoading label="Mapping structure…" />}
      {extractionState.status === 'error' && <SectionError code={extractionState.code} message={extractionState.message} />}
      {extractionState.status === 'done' && (
        <ArgumentExtraction
          result={extractionState.data}
          terminologyPreference={terminologyPreference}
          evidenceAssessments={evidenceState.status === 'done' ? evidenceState.data.assessments : undefined}
        />
      )}
      {auditState.status === 'done' && (
        <div class="mt-4">
          <ToulminCallouts toulmin={auditState.data.toulmin} terminologyPreference={terminologyPreference} />
        </div>
      )}
    </div>
  ) : null;

  // Framework check - Pro engine (auto-runs for subscribers only).
  const frameworkPanel = commitmentsState.status !== 'idle' ? (
    <div class="rounded-lg border border-hairline bg-surface p-4">
      <h3 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted mb-3">
        <LabelWithTooltip label="commitments" preference={terminologyPreference} />
        <ProTag />
      </h3>
      {commitmentsState.status === 'loading' && <SectionLoading label="Detecting frameworks…" />}
      {commitmentsState.status === 'error' && <SectionError code={commitmentsState.code} message={commitmentsState.message} />}
      {commitmentsState.status === 'done' && (
        <PhilosophicalCommitmentsDisplay result={commitmentsState.data} terminologyPreference={terminologyPreference} />
      )}
    </div>
  ) : null;

  // Counterarguments - Pro engine.
  const counterargPanel = (
    <div class="rounded-lg border border-hairline bg-surface p-4">
      <h3 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted mb-3">
        <LabelWithTooltip label="counterarguments" preference={terminologyPreference} />
        <ProTag />
      </h3>
      {/* Pro-gated (Pro-model cost). Free users see the upsell instead of an
         empty box; subscribers get the live result. */}
      {!hasActiveSubscription ? <CounterargUpsell /> : (
        <>
          {counterargState.status === 'loading' && <SectionLoading label="Finding opposing cases…" />}
          {counterargState.status === 'error' && <SectionError code={counterargState.code} message={counterargState.message} />}
          {counterargState.status === 'done' && (
            counterargState.data.counterarguments.length === 0 ? (
              /* Affirmative null state. A clean "nothing found" is a quality
                 signal the draft earned, not an empty card - so we drop the
                 central-claim "(?)" card and show one neutral-toned line (no
                 alarm colour). */
              <p class="text-xs text-muted leading-relaxed">
                <span class="font-medium text-ink">No strong counterarguments surfaced.</span>{' '}
                The draft does not appear to leave an obvious opposing case unaddressed.
              </p>
            ) : (
              <CounterargumentResultDisplay result={counterargState.data} terminologyPreference={terminologyPreference} />
            )
          )}
        </>
      )}
    </div>
  );

  // Deeper lenses - on-demand, free tier, identical to the Reader's. Demoted
  // to a compact strip at the foot of the LEFT column: the Pro-differentiated
  // engines above are what a subscription buys, so they carry the visual
  // weight. All five lenses and their result displays are unchanged in
  // function, only smaller.
  const deeperLensesPanel = auditState.status === 'done' ? (
    <div data-tour-anchor="studio-deeper-lenses" class="rounded-lg border border-hairline bg-surface p-3 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Also on the free tier</h3>
        <span class="text-[11px] text-muted">click any to run</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <LensButton
          compact
          label="Presuppositions"
          status={presupState.status}
          onClick={() => void runLens('presupposition', draft, setPresupState)}
        />
        <LensButton
          compact
          label="Rhetorical mode"
          status={rhetState.status}
          onClick={() => void runLens('rhetorical-mode', draft, setRhetState)}
        />
        <LensButton
          compact
          label="Epistemic humility"
          status={humilityState.status}
          onClick={() => void runLens('epistemic-humility', draft, setHumilityState)}
        />
        <LensButton
          compact
          label="Engagement quality"
          status={disagreeState.status}
          onClick={() => void runLens('disagreement-engagement', draft, setDisagreeState)}
        />
        <LensButton
          compact
          label="Structural incentives"
          status={siState.status}
          onClick={() => void runLens('structural-incentive', draft, setSiState)}
        />
      </div>

      {/* Cui bono caveat - the sharp-edged lens keeps its framing line even in
         compact form: structural, not personal. */}
      <p class="text-[11px] text-muted leading-relaxed">
        Structural incentives asks whose positions in a political economy benefit if a
        reader accepts this framing. Interest-aligned arguments can still be correct.
        Structural, not personal: it surfaces a question, not a verdict.
      </p>

      {presupState.status === 'loading' && <SectionLoading label="Surfacing presuppositions…" />}
      {presupState.status === 'error' && <SectionError code={presupState.code} message={presupState.message} />}
      {presupState.status === 'done' && (
        <div>
          <h4 class="text-xs font-mono font-semibold uppercase tracking-widest text-muted mb-2">Presuppositions</h4>
          <PresuppositionDisplay result={presupState.data} />
        </div>
      )}

      {rhetState.status === 'loading' && <SectionLoading label="Analysing rhetorical balance…" />}
      {rhetState.status === 'error' && <SectionError code={rhetState.code} message={rhetState.message} />}
      {rhetState.status === 'done' && (
        <div>
          <h4 class="text-xs font-mono font-semibold uppercase tracking-widest text-muted mb-2">Rhetorical mode</h4>
          <RhetoricalModeDisplay result={rhetState.data} />
        </div>
      )}

      {humilityState.status === 'loading' && <SectionLoading label="Checking certainty calibration…" />}
      {humilityState.status === 'error' && <SectionError code={humilityState.code} message={humilityState.message} />}
      {humilityState.status === 'done' && (
        <div>
          <h4 class="text-xs font-mono font-semibold uppercase tracking-widest text-muted mb-2">Epistemic humility</h4>
          <EpistemicHumilityDisplay result={humilityState.data} />
        </div>
      )}

      {disagreeState.status === 'loading' && <SectionLoading label="Evaluating engagement with opposing positions…" />}
      {disagreeState.status === 'error' && <SectionError code={disagreeState.code} message={disagreeState.message} />}
      {disagreeState.status === 'done' && (
        <div>
          <h4 class="text-xs font-mono font-semibold uppercase tracking-widest text-muted mb-2">Engagement quality</h4>
          <DisagreementEngagementDisplay result={disagreeState.data} />
        </div>
      )}

      {siState.status === 'loading' && <SectionLoading label="Mapping structural interest alignment…" />}
      {siState.status === 'error' && <SectionError code={siState.code} message={siState.message} />}
      {siState.status === 'done' && (
        <div>
          <h4 class="text-xs font-mono font-semibold uppercase tracking-widest text-muted mb-2">Structural-incentive analysis</h4>
          <StructuralIncentiveDisplay result={siState.data} />
        </div>
      )}
    </div>
  ) : null;

  // Span-anchored findings (RIGHT). Clicking a card scrolls to + flashes its
  // quote in the centre draft. (AuditResults scope="span".)
  const spanFindingsPanel = (
    <div data-tour-anchor="studio-findings" class="rounded-lg border border-hairline bg-surface p-4">
      <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Findings</h3>
      {auditState.status === 'loading' && <SectionLoading label="Running audit…" />}
      {auditState.status === 'error' && <SectionError code={auditState.code} message={auditState.message} />}
      {auditState.status === 'done' && (
        <AuditResults
          result={ctxSev && extractionState.status === 'done' ? applyContextualSeverity(auditState.data, extractionState.data) : auditState.data}
          documentId={docId}
          versionId={versionId}
          initialActions={initialActions}
          terminologyPreference={terminologyPreference}
          scope="span"
          activeFindingKey={activeFindingKey}
          onFindingNavigate={handleNavigateToSpan}
        />
      )}
    </div>
  );

  // Citation audit - Pro engine (LEFT, grouped with the other Pro engines).
  const citationPanel = (
    <div class="rounded-lg border border-hairline bg-surface p-4">
      <h3 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted mb-3">
        <LabelWithTooltip label="citationAudit" preference={terminologyPreference} />
        <ProTag />
      </h3>
      {!hasActiveSubscription ? <CitationUpsell /> : (
        <>
          {citationState.status === 'idle' && (
            <p class="text-xs text-muted italic leading-relaxed">
              Source Match runs when you analyse a draft. It checks <span class="font-medium">linked URLs</span>: re-analyse to check this draft's sources. (Academic-style "(Author, Year)" references without a link can't be fetched.)
            </p>
          )}
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
  );

  // Evidence check - Pro engine (LEFT, grouped with the other Pro engines).
  const evidencePanel = hasActiveSubscription && evidenceState.status !== 'idle' ? (
    <div class="rounded-lg border border-hairline bg-surface p-4">
      <h3 class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted mb-3">
        Evidence Check
        <ProTag />
      </h3>
      {evidenceState.status === 'loading' && <SectionLoading label="Searching academic literature…" />}
      {evidenceState.status === 'error' && <SectionError code={evidenceState.code} message={evidenceState.message} />}
      {evidenceState.status === 'done' && (
        <EvidenceWeightedDisplay result={evidenceState.data} />
      )}
    </div>
  ) : null;

  // LEFT column: score first, then the Pro engines lead, then the skeleton,
  // then the compact free-tier lens strip.
  const leftSidebar = showResults ? (
    <div class="space-y-4">
      {summaryPanel}
      {counterargPanel}
      {frameworkPanel}
      {citationPanel}
      {evidencePanel}
      {skeletonPanel}
      {deeperLensesPanel}
    </div>
  ) : null;

  // RIGHT column: span-anchored specifics.
  const rightSidebar = showResults ? (
    <div class="space-y-4">
      {spanFindingsPanel}
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
            <div class="rounded-lg border border-hairline bg-surface p-4">
              <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                <LabelWithTooltip label="counterarguments" preference={terminologyPreference} />
              </h3>
              <CounterargUpsell />
            </div>
            <div class="rounded-lg border border-hairline bg-surface p-4">
              <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
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

  // Mobile bottom-sheet tabs: Specific (span findings) / Overarching
  // (document-level + engines, Pro engines leading as on desktop) /
  // Structure (the argument skeleton).
  const mobileTabs = showResults ? [
    { id: 'specific',    label: 'Specific',    count: findingsCount, body: (
      <div class="space-y-4">{spanFindingsPanel}</div>
    ) },
    { id: 'overarching', label: 'Overarching', body: (
      <div class="space-y-4">{summaryPanel}{counterargPanel}{frameworkPanel}{citationPanel}{evidencePanel}{deeperLensesPanel}</div>
    ) },
    { id: 'structure',   label: 'Structure',   body: (
      <div class="space-y-4">{skeletonPanel}</div>
    ) },
  ] : [];

  const scoreBadge = score !== null ? (
    <span class="text-xs font-bold rounded-full px-1.5 py-0.5 bg-surface/20">{score}</span>
  ) : null;

  // Three-panel Grammarly-style layout on desktop; single-column + bottom sheet on mobile
  return (
    <>
      <div class="flex flex-col xl:flex-row gap-4 items-start" style={{ minHeight: 'calc(100vh - 6rem)' }}>

        {/* Left sidebar - hidden on mobile (moved to bottom sheet) */}
        <div class="hidden xl:block w-full xl:w-[28%] min-w-0 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overflow-x-hidden space-y-4 xl:order-1">
          {leftSidebar}
        </div>

        {/* Center - always visible. Full width on mobile. */}
        <div class="w-full xl:w-[44%] min-w-0 xl:min-h-[calc(100vh-6rem)] xl:order-2 flex flex-col">
          {inputSection}
        </div>

        {/* Right sidebar - hidden on mobile (moved to bottom sheet) */}
        <div class="hidden xl:block w-full xl:w-[28%] min-w-0 xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overflow-x-hidden space-y-4 xl:order-3">
          {rightSidebar}
        </div>

      </div>

      {/* Mobile bottom-sheet for findings + structure (only after analysis) */}
      {showResults && (
        <MobileFindingsSheet
          tabs={mobileTabs}
          totalFindings={findingsCount}
          scoreBadge={scoreBadge}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          activeTab={sheetTab}
          onActiveTabChange={setSheetTab}
          scrollToKey={activeFindingKey}
        />
      )}
    </>
  );
}
