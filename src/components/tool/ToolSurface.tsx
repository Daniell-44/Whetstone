import { useState, useCallback, useEffect } from 'preact/hooks';
import AuditForm from '../audit/AuditForm';
import StudioEditor from '../studio/StudioEditor';
import type { AuditResult } from '../../lib/audit';
import type { CounterargumentResult } from '../../lib/counterargument';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import type { PhilosophicalCommitmentsResult } from '../../../functions/_lib/philosophical-commitments/types';
import type { CitationAuditResult } from '../../../functions/_lib/citation-audit/types';
import type { TerminologyPreference } from '../../lib/labels';
import { track } from '../../lib/analytics/track';

// ---------------------------------------------------------------------------
// The merged tool surface — one page, two postures.
//
// READ audits someone else's argument. CREATE audits your own draft. This
// replaces the old split between /audit and /creator/studio, which ran the same
// engine behind two separately-maintained pages.
//
// Both halves stay MOUNTED and the inactive one is hidden, so toggling never
// clears a buffer and never re-runs an engine. That was the property the /labs
// prototype existed to test; it is the one thing a naive conditional render
// would get wrong.
//
// The halves are deliberately not fused into a single component. Each is a
// large, tested surface with features the other has no use for — URL auditing,
// the deeper-lens panel and the free steelman on the READ side; saving,
// versioning, Source Match and the draft-specific engines on the CREATE side.
// Merging the two files would have meant reimplementing one inside the other
// for no user-visible gain. The merge users asked for is the toggle.
// ---------------------------------------------------------------------------

export type ToolMode = 'read' | 'create';

interface Props {
  initialMode:      ToolMode;
  isSignedIn:       boolean;

  // READ deep-links (briefing prefill, share target, sample chips).
  initialText?:     string;
  initialUrl?:      string;
  initialSampleId?: string;

  // CREATE state, when reopening a saved draft.
  initialDocId?:                 string | null;
  initialTitle?:                 string;
  initialContent?:               string;
  initialVersionId?:             string | null;
  initialAuditResult?:           AuditResult | null;
  initialCounterargResult?:      CounterargumentResult | null;
  initialExtractionResult?:      ArgumentExtractionResult | null;
  initialCommitmentsResult?:     PhilosophicalCommitmentsResult | null;
  initialCitationAuditResult?:   CitationAuditResult | null;
  initialAnalyzedAt?:            number | null;
  initialActions?:               Record<string, { id: string; action: string; reason?: string | null; updatedAt: number }>;
  terminologyPreference?:        TerminologyPreference;
}

function ModeToggle({ mode, onChange }: { mode: ToolMode; onChange: (m: ToolMode) => void }) {
  const tabs: [ToolMode, string, string][] = [
    ['read',   'READ',   "audit someone else's argument"],
    ['create', 'CREATE', 'audit your own draft'],
  ];
  return (
    <div
      class="flex border border-ink-strong rounded-md overflow-hidden w-full sm:w-auto"
      role="tablist"
      aria-label="Tool mode"
    >
      {tabs.map(([m, label, sub]) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          class={`flex-1 sm:flex-none text-left px-4 py-2 transition-colors ${
            mode === m ? 'bg-ink-strong text-paper' : 'bg-paper text-ink hover:bg-surface'
          }`}
        >
          <span class="block font-mono text-xs font-semibold uppercase tracking-[0.14em]">{label}</span>
          <span class={`block font-mono text-[10px] lowercase tracking-wide ${mode === m ? 'text-paper/70' : 'text-muted'}`}>
            {sub}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function ToolSurface({
  initialMode,
  isSignedIn,
  initialText = '',
  initialUrl = '',
  initialSampleId = '',
  initialContent = '',
  ...studioProps
}: Props) {
  const [mode, setMode] = useState<ToolMode>(initialMode);

  // Bridged text replaces the draft, so the editor is remounted by key. That is
  // intentional: the bridge is an explicit "work on this instead", and a
  // remount is the honest way to say the previous draft is gone.
  const [bridged, setBridged] = useState<{ text: string; seq: number } | null>(null);
  const [confirmBridge, setConfirmBridge] = useState<string | null>(null);

  const draftContent = bridged?.text ?? initialContent;
  const hasDraft     = draftContent.trim().length > 0;

  const switchTo = useCallback((m: ToolMode) => {
    setMode(m);
    track('tool_mode_switched' as any, { mode: m });
    // Keep the address bar honest so a reload, a back button or a shared link
    // lands on the same posture the user was in.
    try {
      const url = new URL(window.location.href);
      if (m === 'create') url.searchParams.set('mode', 'create');
      else                url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());
    } catch { /* history is a nicety; never break the toggle over it */ }
  }, []);

  const sendToDraft = useCallback((text: string) => {
    // Never destroy work silently: if a draft is already in progress and it is
    // not the text being bridged, ask first.
    if (hasDraft && draftContent.trim() !== text.trim()) {
      setConfirmBridge(text);
      return;
    }
    setBridged(b => ({ text, seq: (b?.seq ?? 0) + 1 }));
    switchTo('create');
  }, [hasDraft, draftContent, switchTo]);

  // Escape dismisses the confirm rather than trapping the user in it.
  useEffect(() => {
    if (!confirmBridge) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmBridge(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmBridge]);

  return (
    <div class="space-y-5">
      <ModeToggle mode={mode} onChange={switchTo} />

      {confirmBridge !== null && (
        <div class="rounded-xl border border-amber-300 bg-amber-50 p-4" role="alertdialog" aria-labelledby="bridge-confirm-title">
          <p id="bridge-confirm-title" class="text-sm font-semibold text-ink-strong mb-1">Replace the draft you're working on?</p>
          <p class="text-xs text-ink leading-relaxed mb-3">
            Your Create tab already has text in it. Opening the audited text there will replace it.
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const t = confirmBridge;
                setConfirmBridge(null);
                setBridged(b => ({ text: t, seq: (b?.seq ?? 0) + 1 }));
                switchTo('create');
              }}
              class="rounded-lg bg-ink-strong px-4 py-2 text-xs font-semibold text-paper hover:bg-ink transition-colors"
            >
              Replace it
            </button>
            <button
              type="button"
              onClick={() => setConfirmBridge(null)}
              class="rounded-lg border border-hairline bg-surface px-4 py-2 text-xs font-medium text-ink hover:text-ink-strong transition-colors"
            >
              Keep my draft
            </button>
          </div>
        </div>
      )}

      {/* Both halves stay mounted; `hidden` preserves each buffer across toggles. */}
      <div hidden={mode !== 'read'} data-tool-mode="read">
        <AuditForm
          initialText={initialText}
          initialUrl={initialUrl}
          initialSampleId={initialSampleId}
          onSendToDraft={sendToDraft}
        />
      </div>

      <div hidden={mode !== 'create'} data-tool-mode="create">
        <StudioEditor
          key={bridged ? `bridged-${bridged.seq}` : 'initial'}
          isSignedIn={isSignedIn}
          initialContent={draftContent}
          {...studioProps}
        />
      </div>
    </div>
  );
}
