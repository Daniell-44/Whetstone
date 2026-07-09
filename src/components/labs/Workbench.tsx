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
import { SAMPLES, type Sample } from '../../data/samples';

// ---------------------------------------------------------------------------
// PROTOTYPE — the Read/Create workbench (merge-exploration spec §6).
//
// Purpose: let Daniel FEEL the mode model before Stage 3 is decided. Everything
// engine-shaped resolves to the cached SAMPLES (no API calls, no quota spend);
// persistence and auth are stubbed behind a dev-only tier switcher.
// It answers exactly one question: is Read/Create the right mental model on
// this surface, at 375px and at desktop width?
// ---------------------------------------------------------------------------

type Mode = 'read' | 'create';
type Tier = 'anonymous' | 'free' | 'pro';

interface RunState {
  text:       string;              // the audited text (the buffer at run time)
  audit:      AuditResult;
  extraction: ArgumentExtractionResult;
}

// Any live input resolves to the first sample's cached result — the prototype
// judges the SHELL, not the engine. Example chips load their own sample.
function cannedFor(input: string): Sample {
  const bySample = SAMPLES.find(s => s.text === input);
  return bySample ?? SAMPLES[0]!;
}

function Loading() {
  return (
    <div class="rounded-xl border border-accent/20 bg-accent/5 p-4">
      <p class="text-sm font-medium text-accent mb-2">Reading and analysing the argument…</p>
      <div class="h-1.5 w-full rounded-full bg-accent/10 overflow-hidden">
        <div class="h-full w-2/3 rounded-full bg-accent animate-pulse" />
      </div>
      <p class="text-xs text-accent/70 mt-2">Prototype: cached result, no API call.</p>
    </div>
  );
}

export default function Workbench() {
  const [mode, setMode] = useState<Mode>('read');
  const [tier, setTier] = useState<Tier>('anonymous');

  // Two independent buffers — toggling never clears, never re-runs (spec §1.4).
  const [readInput, setReadInput]     = useState('');
  const [readRun, setReadRun]         = useState<RunState | null>(null);
  const [createTitle, setCreateTitle] = useState('Untitled draft');
  const [createDraft, setCreateDraft] = useState('');
  const [createRun, setCreateRun]     = useState<RunState | null>(null);
  const [audience, setAudience]       = useState<Audience>('general');
  const [intent, setIntent]           = useState<Intent>('persuade');

  const [loading, setLoading]         = useState(false);
  const [activeFindingKey, setActiveFindingKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [bridgeConfirm, setBridgeConfirm] = useState(false);
  const [banner, setBanner]           = useState(true);
  const [toast, setToast]             = useState<string | null>(null);

  const run     = mode === 'read' ? readRun : createRun;
  const setRun  = mode === 'read' ? setReadRun : setCreateRun;
  const signedIn = tier !== 'anonymous';

  function say(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  function fakeRun(text: string) {
    if (text.trim().length < 20) { say('Prototype: paste or type at least a sentence.'); return; }
    setLoading(true);
    setActiveFindingKey(null);
    const s = cannedFor(text);
    window.setTimeout(() => {
      setRun({ text: s.text, audit: s.cached.audit as AuditResult, extraction: s.cached.extraction as ArgumentExtractionResult });
      if (mode === 'read') setReadInput(s.text); else setCreateDraft(s.text);
      setLoading(false);
    }, 1200);
  }

  function loadSample(s: Sample) {
    setLoading(true);
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

        {/* Dev-only tier switcher — how all six matrix cells get felt. */}
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
              onClick={() => fakeRun(readInput)}
              aria-label="Audit this argument"
              class="absolute right-2.5 bottom-2.5 w-11 h-11 rounded-full bg-accent text-paper flex items-center justify-center hover:bg-accent/90 transition-colors"
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
              onClick={() => fakeRun(createDraft)}
              class="rounded-lg bg-accent-support px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-support/90 transition-colors"
            >
              Analyse my draft
            </button>
          </div>
        </div>
      )}

      {loading && <Loading />}

      {/* ---- Anonymous-Create banner (spec §2): dismissible, non-modal ---- */}
      {mode === 'create' && !signedIn && createRun && banner && !loading && (
        <div class="flex items-start gap-3 rounded-lg border border-hairline bg-surface px-4 py-3">
          <p class="text-xs text-ink leading-relaxed flex-1">
            <span class="font-mono uppercase tracking-wider text-muted">Signed out</span>
            <span class="mx-2 text-hairline">·</span>
            This draft is not saved. Sign in free to save drafts and versions.
          </p>
          <button type="button" onClick={() => say('Prototype: sign-in is stubbed.')} class="text-xs font-medium text-accent-support hover:text-accent shrink-0 py-1">Sign in</button>
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

          {/* Canvas + desktop rail */}
          <div class="flex flex-col xl:flex-row gap-4 items-start">
            <div class="w-full xl:w-[55%] rounded-lg border border-hairline bg-surface p-4">
              <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">{mode === 'read' ? 'The text' : 'Your draft'}</p>
              <HighlightedDraft text={run.text} audit={run.audit} activeFindingKey={activeFindingKey} onHighlightClick={goToFinding} />
            </div>

            <div class="hidden xl:block w-full xl:w-[45%] space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
              <div class="rounded-lg border border-hairline bg-surface p-4">
                <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Findings</p>
                <AuditResults result={run.audit} scope="span" flush activeFindingKey={activeFindingKey} />
              </div>
              <div class="rounded-lg border border-hairline bg-surface p-4 space-y-4">
                <p class="text-xs font-semibold uppercase tracking-widest text-muted">Argument structure</p>
                <ArgumentExtraction result={run.extraction} />
                <ToulminCallouts toulmin={run.audit.toulmin} />
              </div>
            </div>
          </div>

          {/* Counterargument, mode-bound (spec §1.3 / OWNER-CALL counterarg-1) */}
          {mode === 'read' ? (
            <div class="rounded-xl border border-hairline bg-surface p-5">
              <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">The strongest opposing case</p>
              <p class="text-sm text-ink leading-relaxed mb-3">What would the most careful person who disagrees say? <span class="font-mono text-[10px] uppercase tracking-wider text-muted">cached demo</span></p>
              <p class="text-sm text-ink leading-relaxed border-l-2 border-hairline pl-3">
                The argument's strongest opposition concedes the safety data but rejects the inference: population-level injury statistics do not settle whether the state may compel competent adults, and the seatbelt analogy fails at exactly the point it is doing the work.
              </p>
            </div>
          ) : tier === 'pro' ? (
            <div class="rounded-xl border border-hairline bg-surface p-5">
              <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Objections your draft doesn't engage</p>
              <div class="space-y-3">
                <div class="rounded-lg border border-hairline bg-paper p-3">
                  <p class="text-sm font-serif font-semibold text-ink-strong mb-1">The autonomy objection</p>
                  <p class="text-xs text-ink leading-relaxed">Your draft never addresses the strongest counter: that individual risk-bearing by competent adults is not the state's to manage. <span class="font-mono text-[10px] uppercase tracking-wider text-muted">cached demo</span></p>
                </div>
                <div class="rounded-lg border border-hairline bg-paper p-3">
                  <p class="text-sm font-serif font-semibold text-ink-strong mb-1">The disanalogy objection</p>
                  <p class="text-xs text-ink leading-relaxed">The seatbelt comparison is asserted, not argued; an opponent will attack the analogy's load-bearing premise directly.</p>
                </div>
              </div>
            </div>
          ) : (
            <div class="rounded-xl border border-hairline bg-paper p-5">
              <div class="flex items-center gap-2 mb-2">
                <p class="text-xs font-semibold uppercase tracking-widest text-accent">Counterargument</p>
                <span class="font-mono text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border border-hairline text-muted">Studio</span>
              </div>
              <p class="text-sm text-ink leading-relaxed mb-3">The objections a careful opponent would raise against your draft, each with its own structure. Part of Studio.</p>
              <button type="button" onClick={() => say('Prototype: upgrade flow is stubbed.')} class="rounded-lg bg-accent-support px-4 py-2 text-xs font-semibold text-white hover:bg-accent-support/90 transition-colors">See plans</button>
            </div>
          )}

          {/* Deeper lenses: auth-gated per lens (both modes, same rule) */}
          <div class="rounded-xl border border-hairline bg-surface p-5">
            <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Deeper lenses</p>
            <div class="flex gap-2 flex-wrap">
              {['Presupposition', 'Rhetorical mode', 'Epistemic humility', 'Disagreement engagement', 'Structural incentive'].map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => say(signedIn ? 'Prototype: lens runs are stubbed.' : 'Sign in to use this lens (free).')}
                  class={`text-xs border rounded px-2.5 py-1.5 transition-colors ${signedIn ? 'border-hairline text-accent-support hover:border-accent-support/50' : 'border-hairline text-muted'}`}
                >
                  {l}{!signedIn && ' ·  sign in'}
                </button>
              ))}
            </div>
          </div>

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
            { id: 'structure', label: 'Structure', body: <div class="space-y-4"><ArgumentExtraction result={run.extraction} /><ToulminCallouts toulmin={run.audit.toulmin} /></div> },
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
