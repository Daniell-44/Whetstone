import { useState } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import { auditVerdict, lensesChecked } from '../../lib/audit';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import type { Audience, Intent } from '../../../functions/_lib/audit/goals';
import AuditResults from '../audit/AuditResults';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import ToulminCallouts from '../audit/ToulminCallouts';
import HighlightedDraft from '../studio/HighlightedDraft';
import MobileFindingsSheet from '../studio/MobileFindingsSheet';
import GoalSelector from '../studio/GoalSelector';
import ReaderOpposingCase from '../counterargument/ReaderOpposingCase';
import DeeperLensPanel from '../lens-panel/DeeperLensPanel';
import AuditLoading from '../tool/AuditLoading';
import StudioTag from '../tool/StudioTag';
import { SAMPLES, type Sample } from '../../data/samples';
import { callEngine, NETWORK_MESSAGE } from '../tool/engine';
import { MIN_CHARS, MAX_CHARS, URL_RE, READER_AUDIT_ERROR_MESSAGES } from '../tool/constants';

// ---------------------------------------------------------------------------
// The Read/Create workbench — graduating from prototype to production
// (Stage 3 port, per the merge adjudication: Workbench + satellites).
//
// Port slice 1: READ posture runs the real free engines — /api/audit
// (+ /api/extract-argument for pasted text) through the shared tool/engine
// plumbing, with the Reader's validation bounds and error copy. Sample chips
// stay cached demos (no API call).
//
// Port slice 2: CREATE posture runs for real too. Signed-in (a REAL session,
// via the page's server props): the document/version bootstrap ported from
// StudioEditor — first Analyse creates the document, later Analyses with
// changed content append versions, engines run version-scoped so results
// persist server-side. Anonymous: the free engines on the draft, nothing
// saved, the banner explains. The dev tier switcher initialises from the
// real tier and remains a DISPLAY override (persistence always requires the
// real session — the server enforces it regardless of the switcher).
// Still deferred: Pro auto-fire panels, ?doc= rehydration, title autosave.
// No analytics fire from here — the labs page is dropped or gated before any
// production deploy.
// ---------------------------------------------------------------------------

type Mode = 'read' | 'create';
type Tier = 'anonymous' | 'free' | 'pro';

interface RunState {
  text:       string;              // the audited text (the buffer at run time)
  audit:      AuditResult;
  extraction: ArgumentExtractionResult | null;  // best-effort — audit renders without it
}

// Any live input resolves to the first sample's cached result — the prototype
// judges the SHELL, not the engine. Example chips load their own sample.
function cannedFor(input: string): Sample {
  const bySample = SAMPLES.find(s => s.text === input);
  return bySample ?? SAMPLES[0]!;
}

interface Props {
  /** Whether a real session cookie authenticated (server-read, not the dev switcher). */
  realSignedIn?: boolean;
  /** Whether that session has an active Studio subscription. */
  realPro?: boolean;
}

export default function Workbench({ realSignedIn = false, realPro = false }: Props) {
  const [mode, setMode] = useState<Mode>('read');
  const [tier, setTier] = useState<Tier>(realPro ? 'pro' : realSignedIn ? 'free' : 'anonymous');

  // Two independent buffers — toggling never clears, never re-runs (spec §1.4).
  const [readInput, setReadInput]     = useState('');
  const [readRun, setReadRun]         = useState<RunState | null>(null);
  const [createTitle, setCreateTitle] = useState('Untitled draft');
  const [createDraft, setCreateDraft] = useState('');
  const [createRun, setCreateRun]     = useState<RunState | null>(null);
  const [audience, setAudience]       = useState<Audience>('general');
  const [intent, setIntent]           = useState<Intent>('persuade');

  // Create-side persistence (slice 2): the document/version chain a signed-in
  // Analyse creates, mirroring StudioEditor's bootstrap.
  const [createDocId, setCreateDocId]           = useState<string | null>(null);
  const [createVersionId, setCreateVersionId]   = useState<string | null>(null);
  const [lastSavedContent, setLastSavedContent] = useState<string | null>(null);

  const [loading, setLoading]         = useState(false);
  const [readError, setReadError]     = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeFindingKey, setActiveFindingKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [bridgeConfirm, setBridgeConfirm] = useState(false);
  const [banner, setBanner]           = useState(true);
  const [toast, setToast]             = useState<string | null>(null);

  const run     = mode === 'read' ? readRun : createRun;
  const signedIn = tier !== 'anonymous';
  // Persistence needs the REAL session, whatever the display switcher says -
  // the document endpoints 401 without a cookie. Switching the display to
  // "anonymous" also runs Create unsaved, so that cell can be felt too.
  const canPersist = realSignedIn && tier !== 'anonymous';

  function say(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  // READ posture: the real engines. Audit + (for pasted text) the argument
  // skeleton run in parallel; extraction is best-effort exactly as in the
  // Reader - a failed skeleton never blocks the audit.
  async function realRead(raw: string) {
    const t = raw.trim();
    // Cold-open friendliness survives the port: an EMPTY submit demos a
    // cached sample rather than scolding.
    if (!t) { say('Nothing pasted - showing a cached demo.'); loadSample(SAMPLES[0]!); return; }

    const isUrl = URL_RE.test(t);
    if (!isUrl && raw.length < MIN_CHARS) {
      setReadError(`Audits need at least ${MIN_CHARS} characters - ${MIN_CHARS - raw.length} more to go.`);
      return;
    }
    if (!isUrl && raw.length > MAX_CHARS) {
      setReadError(`That's over the ${MAX_CHARS.toLocaleString()}-character limit - trim it down.`);
      return;
    }

    setReadError(null);
    setLoading(true);
    setActiveFindingKey(null);

    const [auditOut, extractionOut] = await Promise.all([
      callEngine<AuditResult>({
        url:           '/api/audit',
        body:          isUrl ? { url: t } : { text: raw },
        pick:          d => d.audit,
        errorMessages: READER_AUDIT_ERROR_MESSAGES,
      }),
      isUrl
        ? Promise.resolve(null)
        : callEngine<ArgumentExtractionResult>({
            url:  '/api/extract-argument',
            body: { text: raw },
            pick: d => d.extraction,
          }),
    ]);

    if (auditOut.ok) {
      // URL audits highlight the server-extracted article body; if the server
      // sent none, the findings render full-width with no canvas.
      const sourceText = (auditOut.envelope.sourceText as string | undefined) ?? (isUrl ? '' : raw);
      setReadRun({
        text:       sourceText,
        audit:      auditOut.data,
        extraction: extractionOut && extractionOut.ok ? extractionOut.data : null,
      });
    } else {
      setReadError(auditOut.message);
    }
    setLoading(false);
  }

  // CREATE posture, cold-open only: an empty Analyse demos a cached sample.
  function fakeCreateRun() {
    setLoading(true);
    setActiveFindingKey(null);
    const s = cannedFor('');
    window.setTimeout(() => {
      setCreateRun({ text: s.text, audit: s.cached.audit as AuditResult, extraction: s.cached.extraction as ArgumentExtractionResult });
      setCreateDraft(s.text);
      setLoading(false);
    }, 1200);
  }

  // CREATE posture: the real engines (slice 2). Signed-in Analyse persists
  // first - create the document (or append a version when the content
  // changed), then run the version-scoped engines so results land on the
  // saved version server-side. Anonymous runs the free engines unsaved.
  async function realCreate() {
    const raw = createDraft;
    if (!raw.trim()) { say('Nothing written yet - showing a cached demo.'); fakeCreateRun(); return; }
    if (raw.length < MIN_CHARS) {
      setCreateError(`Analyses need at least ${MIN_CHARS} characters - ${MIN_CHARS - raw.length} more to go.`);
      return;
    }
    if (raw.length > MAX_CHARS) {
      setCreateError(`That's over the ${MAX_CHARS.toLocaleString()}-character limit - trim it down.`);
      return;
    }

    setCreateError(null);
    setLoading(true);
    setActiveFindingKey(null);

    let auditUrl      = '/api/audit';
    let auditBody: unknown      = { text: raw };
    let extractionUrl = '/api/extract-argument';
    let extractionBody: unknown = { text: raw };

    if (canPersist) {
      // --- ensure document + version exist (ported from StudioEditor) ---
      let doc = createDocId;
      let ver = createVersionId;
      try {
        if (!doc) {
          const res  = await fetch('/api/documents', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ title: createTitle || 'Untitled draft', content: raw }),
          });
          const data = await res.json() as { ok: boolean; docId?: string; versionId?: string };
          if (!data.ok || !data.docId) {
            setCreateError("Couldn't save the draft - try again in a moment.");
            setLoading(false);
            return;
          }
          doc = data.docId;
          ver = data.versionId ?? null;
          setCreateDocId(doc);
          setCreateVersionId(ver);
          setLastSavedContent(raw);
          const url = new URL(window.location.href);
          url.searchParams.set('doc', doc);
          window.history.replaceState({}, '', url.toString());
        } else if (raw !== lastSavedContent) {
          const res  = await fetch(`/api/documents/${doc}/versions`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ content: raw }),
          });
          const data = await res.json() as { ok: boolean; versionId?: string };
          if (!data.ok || !data.versionId) {
            setCreateError("Couldn't save this version - try again in a moment.");
            setLoading(false);
            return;
          }
          ver = data.versionId;
          setCreateVersionId(ver);
          setLastSavedContent(raw);
        }
      } catch {
        setCreateError(NETWORK_MESSAGE);
        setLoading(false);
        return;
      }
      if (!doc || !ver) { setLoading(false); return; }
      const versionPath = `/api/documents/${doc}/versions/${ver}`;
      auditUrl       = `${versionPath}/audit`;
      auditBody      = { audience, intent };  // goals feed the engine on the saved path
      extractionUrl  = `${versionPath}/extraction`;
      extractionBody = undefined;             // bare POST - the version holds the content
    }

    const [auditOut, extractionOut] = await Promise.all([
      callEngine<AuditResult>({
        url:           auditUrl,
        body:          auditBody,
        pick:          d => d.audit,
        errorMessages: READER_AUDIT_ERROR_MESSAGES,
      }),
      callEngine<ArgumentExtractionResult>({
        url:  extractionUrl,
        body: extractionBody,
        pick: d => d.extraction,
      }),
    ]);

    if (auditOut.ok) {
      setCreateRun({
        text:       raw,
        audit:      auditOut.data,
        extraction: extractionOut.ok ? extractionOut.data : null,
      });
      setBanner(true);
    } else {
      setCreateError(auditOut.message);
    }
    setLoading(false);
  }

  function loadSample(s: Sample) {
    setLoading(true);
    setReadError(null);
    setActiveFindingKey(null);
    window.setTimeout(() => {
      setReadRun({ text: s.text, audit: s.cached.audit as AuditResult, extraction: s.cached.extraction as ArgumentExtractionResult });
      setReadInput(s.text);
      setLoading(false);
    }, 1200);
  }

  // Read → Create bridge (spec §1.4): copy the audited text into the Create
  // buffer; ask before replacing a dirty draft; never silent destruction.
  function bridge() {
    if (!readRun) return;
    if (createDraft.trim() && createDraft !== readRun.text) { setBridgeConfirm(true); return; }
    doBridge();
  }
  function doBridge() {
    if (!readRun) return;
    setCreateDraft(readRun.text);
    setCreateRun(null);
    // Bridging a DIFFERENT text into Create must start a fresh document, or the
    // next Analyse would append the bridged article as a new VERSION of the
    // document already open under a foreign title. Null the doc chain and clear
    // the ?doc so a new document is created.
    setCreateDocId(null);
    setCreateVersionId(null);
    setLastSavedContent(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('doc');
      window.history.replaceState({}, '', url.toString());
    }
    setBridgeConfirm(false);
    setMode('create');
  }

  function goToFinding(key: string) {
    setActiveFindingKey(key);
    if (window.matchMedia('(min-width: 1280px)').matches) {
      requestAnimationFrame(() => {
        document.querySelector(`[data-finding-key="${CSS.escape(key)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      setSheetOpen(true);
    }
  }

  const counts = run ? (() => {
    const g = [run.audit.namedFallacies, run.audit.loadedLanguage, run.audit.keyTermScrutiny ?? [], run.audit.referentChecks ?? [], run.audit.falsifiabilityChecks ?? [], run.audit.modalScopeChecks ?? []] as { severity: string }[][];
    let total = 0, critical = 0;
    for (const grp of g) for (const f of grp) { total++; if (f.severity === 'high') critical++; }
    return { total, critical };
  })() : { total: 0, critical: 0 };

  return (
    <div class="space-y-5">

      {/* ---- Apparatus row: mode control + dev tier switcher ---- */}
      <div class="flex items-start justify-between gap-3 flex-wrap">
        {/* Two-segment mode control (spec §1.2): mono apparatus, graphite
           active fill, NO redline. Sublabels carry the meaning. */}
        <div class="flex border border-ink-strong rounded-md overflow-hidden w-full sm:w-auto" role="tablist" aria-label="Workbench mode">
          {([['read', 'READ', 'audit someone else’s argument'], ['create', 'CREATE', 'audit your own draft']] as [Mode, string, string][]).map(([m, label, sub]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setActiveFindingKey(null); setSheetOpen(false); }}
              class={`flex-1 sm:flex-none text-left px-4 py-2 transition-colors ${mode === m ? 'bg-ink-strong text-paper' : 'bg-paper text-ink hover:bg-surface'}`}
            >
              <span class="block font-mono text-xs font-semibold uppercase tracking-[0.14em]">{label}</span>
              <span class={`block font-mono text-[10px] lowercase tracking-wide ${mode === m ? 'text-paper/70' : 'text-muted'}`}>{sub}</span>
            </button>
          ))}
        </div>

        {/* Dev-only tier switcher — how all six matrix cells get felt. Gated to
           DEV so it can never ship to production when the workbench takes over
           /audit; in prod the tier is the real session's tier only. */}
        {import.meta.env.DEV && (
          <label class="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted shrink-0">
            Dev tier
            <select
              value={tier}
              onChange={e => { setTier((e.target as HTMLSelectElement).value as Tier); setBanner(true); }}
              class="border border-hairline bg-surface rounded px-2 py-1.5 font-mono text-xs text-ink"
            >
              <option value="anonymous">Anonymous</option>
              <option value="free">Signed-in free</option>
              <option value="pro">Studio Pro</option>
            </select>
          </label>
        )}
      </div>

      {/* ---- Input shell (the thing the toggle swaps) ---- */}
      {mode === 'read' ? (
        <div class="space-y-3">
          <div class="relative">
            <textarea
              value={readInput}
              onInput={e => setReadInput((e.target as HTMLTextAreaElement).value)}
              placeholder="Paste an argument, or drop a link…"
              aria-label="Argument text or URL to audit"
              rows={3}
              class="w-full rounded-xl border border-hairline bg-surface pl-4 pr-16 py-3 text-base sm:text-sm text-ink placeholder-muted leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
            />
            <button
              type="button"
              onClick={() => void realRead(readInput)}
              aria-label="Audit this argument"
              class="absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full bg-accent-support text-paper flex items-center justify-center hover:bg-accent-support/90 transition-colors"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] font-mono uppercase tracking-wider text-muted/80 shrink-0">Try</span>
            {SAMPLES.map(s => (
              <button key={s.id} type="button" onClick={() => loadSample(s)} class="text-xs border border-hairline rounded px-2.5 py-1.5 text-accent-support hover:border-accent-support/50 hover:text-accent transition-colors">
                {s.shortLabel}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div class="space-y-3">
          <input
            value={createTitle}
            onInput={e => setCreateTitle((e.target as HTMLInputElement).value)}
            aria-label="Draft title"
            class="w-full bg-transparent border-b border-hairline pb-1.5 text-lg font-serif text-ink-strong focus:outline-none focus:border-accent"
          />
          <details class="rounded-lg border border-hairline bg-surface">
            <summary class="px-4 py-2.5 cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted">
              Audience &amp; intent {!signedIn && <span class="font-mono normal-case tracking-normal text-muted/80 ml-2">sign in to tailor the audit</span>}
            </summary>
            <div class="px-4 pb-4 pt-1">
              <GoalSelector audience={audience} intent={intent} onAudienceChange={setAudience} onIntentChange={setIntent} disabled={!signedIn} />
            </div>
          </details>
          <textarea
            value={createDraft}
            onInput={e => setCreateDraft((e.target as HTMLTextAreaElement).value)}
            placeholder="Write or paste your draft…"
            aria-label="Your draft"
            class="w-full min-h-[40vh] rounded-xl border border-hairline bg-surface px-4 py-3 text-base sm:text-sm text-ink placeholder-muted leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
          />
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <span class="text-xs text-muted">{createDraft.trim() ? `${createDraft.trim().split(/\s+/).length.toLocaleString()} words` : ''}</span>
            <button
              type="button"
              onClick={() => void realCreate()}
              class="rounded-lg bg-accent-support px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-support/90 transition-colors"
            >
              Analyse my draft
            </button>
          </div>
        </div>
      )}

      {(mode === 'read' ? readError : createError) && !loading && (
        <div class="rounded-lg border border-hairline bg-surface px-4 py-2.5" role="alert">
          <p class="text-xs text-ink leading-relaxed">
            <span class="font-mono uppercase tracking-wider text-muted mr-2">Couldn't run</span>
            {mode === 'read' ? readError : createError}
          </p>
        </div>
      )}

      {loading && <AuditLoading />}

      {/* ---- Anonymous-Create banner (spec §2): dismissible, non-modal ---- */}
      {mode === 'create' && !signedIn && createRun && banner && !loading && (
        <div class="flex items-start gap-3 rounded-lg border border-hairline bg-surface px-4 py-3">
          <p class="text-xs text-ink leading-relaxed flex-1">
            <span class="font-mono uppercase tracking-wider text-muted">Signed out</span>
            <span class="mx-2 text-hairline">·</span>
            This draft is not saved. Sign in free to save drafts and versions.
          </p>
          <a href="/login?returnTo=/labs/workbench" class="text-xs font-medium text-accent-support hover:text-accent shrink-0 py-1">Sign in</a>
          <button type="button" onClick={() => setBanner(false)} aria-label="Dismiss" class="text-muted hover:text-ink shrink-0 px-1 py-1">✕</button>
        </div>
      )}

      {/* ---- Shared results shell ---- */}
      {run && !loading && (
        <div class="space-y-4">

          {/* Verdict bar + (Read) the bridge into Create */}
          <div class="rounded-lg border border-hairline bg-surface px-4 py-3 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-ink-strong">{counts.total} {counts.total === 1 ? 'issue' : 'issues'} found</span>
              {counts.critical > 0 && (
                <span class="inline-flex items-center gap-1 text-xs text-muted">
                  <span class="w-1.5 h-1.5 rounded-full bg-sev-high" aria-hidden="true" /> {counts.critical} critical
                </span>
              )}
              {mode === 'create' && <span class="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted">{createTitle || 'Untitled draft'}</span>}
            </div>
            <p class="text-xs text-ink leading-relaxed">{auditVerdict(run.audit)}</p>
            <p class="text-xs text-muted line-clamp-1"><span class="font-medium text-ink">Weakest link:</span> {run.audit.toulmin.weakestLink}</p>
            <div class="flex items-center gap-x-3 gap-y-1 flex-wrap pt-2 border-t border-hairline">
              <span class="text-[0.625rem] font-mono uppercase tracking-wider text-muted shrink-0">Checked</span>
              {lensesChecked(run.audit).map(l => (
                <span key={l.key} class="inline-flex items-center gap-1 text-xs text-muted">{l.label}<span class={`font-mono ${l.count > 0 ? 'text-ink font-medium' : 'text-muted/70'}`}>{l.count}</span></span>
              ))}
            </div>
            {mode === 'read' && (
              bridgeConfirm ? (
                <p class="text-xs text-ink pt-1.5 border-t border-hairline flex items-center gap-2 flex-wrap">
                  Replace your current draft?
                  <button type="button" onClick={doBridge} class="font-medium text-accent-support hover:text-accent py-1">Replace</button>
                  <button type="button" onClick={() => setBridgeConfirm(false)} class="text-muted hover:text-ink py-1">Keep my draft</button>
                </p>
              ) : (
                <button type="button" onClick={bridge} class="font-mono text-[11px] uppercase tracking-wider text-accent-support hover:text-accent transition-colors pt-1.5">
                  Work on this text in Create →
                </button>
              )
            )}
          </div>

          {/* Canvas + desktop rail. A URL audit with no extracted body has no
             canvas - findings take the full width. */}
          <div class="flex flex-col xl:flex-row gap-4 items-start">
            {run.text && (
              <div class="w-full xl:w-[55%] rounded-lg border border-hairline bg-surface p-4">
                <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">{mode === 'read' ? 'The text' : 'Your draft'}</p>
                <HighlightedDraft text={run.text} audit={run.audit} activeFindingKey={activeFindingKey} onHighlightClick={goToFinding} />
              </div>
            )}

            <div class={`hidden xl:block w-full space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto ${run.text ? 'xl:w-[45%]' : ''}`}>
              <div class="rounded-lg border border-hairline bg-surface p-4">
                <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Findings</p>
                <AuditResults result={run.audit} scope="span" flush activeFindingKey={activeFindingKey} />
              </div>
              <div class="rounded-lg border border-hairline bg-surface p-4 space-y-4">
                <p class="text-xs font-semibold uppercase tracking-widest text-muted">Argument structure</p>
                {run.extraction && <ArgumentExtraction result={run.extraction} />}
                <ToulminCallouts toulmin={run.audit.toulmin} />
              </div>
            </div>
          </div>

          {/* Counterargument slot. Read runs the REAL free opposing-case engine
             on the audited text (no fabricated prose under real findings —
             CLAUDE.md's cardinal sin). Create's counterargument is a Pro engine
             that lives in Studio; the workbench points at it honestly rather
             than inventing objections. */}
          {mode === 'read' ? (
            run.text && <ReaderOpposingCase text={run.text} />
          ) : (
            <div class="rounded-xl border border-hairline bg-paper p-5">
              <div class="flex items-center gap-2 mb-2">
                <p class="text-xs font-semibold uppercase tracking-widest text-accent-support">Counterargument</p>
                <StudioTag />
              </div>
              <p class="text-sm text-ink leading-relaxed mb-3">The objections a careful opponent would raise against your draft, each with its own structure. Run it in Studio.</p>
              <a href="/creator/studio" class="inline-block rounded-lg bg-accent-support px-4 py-2 text-xs font-semibold text-white hover:bg-accent-support/90 transition-colors">Open Studio →</a>
            </div>
          )}

          {/* Deeper lenses: the REAL panel (free with sign-in; the endpoints
             gate on session only). Needs the audited text. */}
          {run.text && <DeeperLensPanel text={run.text} surface={mode === 'read' ? 'reader' : 'studio'} isPro={tier === 'pro'} />}

        </div>
      )}

      {/* Mobile sheet (below xl) — the shared results shell */}
      {run && !loading && (
        <MobileFindingsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          scrollToKey={activeFindingKey}
          totalFindings={counts.total}
          tabs={[
            { id: 'findings', label: 'Findings', count: counts.total, body: <AuditResults result={run.audit} scope="span" flush activeFindingKey={activeFindingKey} /> },
            { id: 'structure', label: 'Structure', body: <div class="space-y-4">{run.extraction && <ArgumentExtraction result={run.extraction} />}<ToulminCallouts toulmin={run.audit.toulmin} /></div> },
          ]}
        />
      )}

      {/* Stub toast */}
      {toast && (
        <div class="fixed left-1/2 -translate-x-1/2 z-[60] bg-ink-strong text-paper text-xs px-4 py-2.5 rounded-lg shadow-lg" style="bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px));">
          {toast}
        </div>
      )}
    </div>
  );
}
