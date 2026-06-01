import { useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { AuditResult, UnstatedWarrant, NamedFallacy, LoadedLanguage } from '../../lib/audit';
import { sortByPriority, fallacyMatchKey, loadedLanguageMatchKey, unstatedWarrantMatchKey } from '../../lib/audit';
import LabelWithTooltip from '../ui/LabelWithTooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionRecord = { id: string; action: string; reason?: string | null; updatedAt: number };
type ActionsMap   = Map<string, ActionRecord>;

interface Props {
  result:          AuditResult;
  documentId?:     string | null;
  versionId?:      string | null;
  initialActions?: Record<string, { id: string; action: string; reason?: string | null; updatedAt: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
// Shared meta badges
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_BADGE[severity] ?? 'bg-gray-100 text-gray-600';
  return (
    <span class={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cls}`}>
      {severity}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  return (
    <span class="text-xs text-gray-400 shrink-0">{confidence}%</span>
  );
}

function AddressedBadge() {
  return (
    <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-emerald-100 text-emerald-700">
      ✓ addressed
    </span>
  );
}

// ---------------------------------------------------------------------------
// FeedbackBtns — thumbs-up / thumbs-down per finding
// ---------------------------------------------------------------------------

type VoteState = 'up' | 'down' | null;

interface FeedbackBtnsProps {
  documentId?:     string | null;
  versionId?:      string | null;
  targetLens:      string;
  matchKey:        string;
  findingSnapshot: unknown;
}

function FeedbackBtns({ documentId, versionId, targetLens, matchKey, findingSnapshot }: FeedbackBtnsProps) {
  // Hidden when no document context (anonymous public audit pages)
  if (!documentId) return null;

  const [vote,        setVote]        = useState<VoteState>(null);
  const [expanded,    setExpanded]    = useState(false);
  const [reason,      setReason]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  async function postVote(feedbackType: 'finding_thumbs_up' | 'finding_thumbs_down', qualitative?: string) {
    setSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType,
          documentId,
          versionId: versionId ?? null,
          targetLens,
          matchKey,
          findingSnapshot,
          qualitative: qualitative ?? null,
        }),
      });
    } catch { /* fire-and-forget — vote still registers in UI */ }
    setSubmitting(false);
  }

  function handleUp() {
    if (vote === 'up') { setVote(null); return; }        // toggle off (client-only)
    setVote('up');
    setExpanded(false);
    postVote('finding_thumbs_up');
  }

  function handleDown() {
    if (vote === 'down') { setVote(null); setExpanded(false); return; } // toggle off
    setVote('down');
    setExpanded(true);
  }

  async function submitDown(qualitative: string) {
    setExpanded(false);
    await postVote('finding_thumbs_down', qualitative || undefined);
  }

  return (
    <div class="mt-2">
      <div class="flex items-center gap-1.5">
        {/* Thumbs up */}
        <button
          type="button"
          title={vote === 'up' ? 'Remove vote' : 'This finding is helpful'}
          onClick={handleUp}
          disabled={submitting}
          class={`p-1 rounded transition-colors disabled:opacity-40 ${
            vote === 'up'
              ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
          }`}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0114 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 01-1.341 5.974C17.153 16.323 16.09 17 14.9 17H8c-.366 0-.721-.12-1-.34V8l4-5z" />
          </svg>
        </button>

        {/* Thumbs down */}
        <button
          type="button"
          title={vote === 'down' ? 'Remove vote' : 'This finding seems off'}
          onClick={handleDown}
          disabled={submitting}
          class={`p-1 rounded transition-colors disabled:opacity-40 ${
            vote === 'down'
              ? 'text-rose-500 bg-rose-50 hover:bg-rose-100'
              : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
          }`}
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M18.905 12.75a1.25 1.25 0 11-2.5 0v-7.5a1.25 1.25 0 112.5 0v7.5zM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 015.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.243 0-2.261-1.01-2.146-2.247a23.864 23.864 0 011.341-5.974C2.752 3.677 3.815 3 5.005 3h6.9c.366 0 .721.12 1 .34V12l-4 5z" />
          </svg>
        </button>
      </div>

      {/* Thumbs-down expander */}
      {expanded && (
        <div class="mt-2 space-y-2">
          <p class="text-xs text-gray-500">What did the engine get wrong? <span class="text-gray-400">(optional)</span></p>
          <textarea
            value={reason}
            onInput={(e) => setReason((e.target as HTMLTextAreaElement).value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. The quote is taken out of context…"
            class="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-700 resize-none focus:outline-none focus:ring-1 focus:ring-rose-300"
          />
          <div class="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitDown(reason)}
              class="text-xs px-2.5 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-40"
            >
              Submit feedback
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitDown('')}
              class="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Just downvote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useActionState hook
// ---------------------------------------------------------------------------

function useActionState(
  documentId: string | null | undefined,
  initialActions: Record<string, ActionRecord> | undefined,
) {
  const [actions, setActions] = useState<ActionsMap>(() => {
    const m = new Map<string, ActionRecord>();
    if (initialActions) {
      for (const [k, v] of Object.entries(initialActions)) m.set(k, v);
    }
    return m;
  });
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [errors,   setErrors]   = useState<Map<string, string>>(new Map());

  const setAction = useCallback(async (
    lens: string,
    matchKey: string,
    action: string,
    reason?: string | null,
  ) => {
    if (!documentId) return;
    const compositeKey = `${lens}:${matchKey}`;

    // Optimistic update
    const previous = actions.get(compositeKey);
    setActions(prev => {
      const next = new Map(prev);
      next.set(compositeKey, { id: previous?.id ?? '', action, reason: reason ?? null, updatedAt: Date.now() });
      return next;
    });
    setBusyKeys(prev => new Set([...prev, compositeKey]));
    setErrors(prev => { const next = new Map(prev); next.delete(compositeKey); return next; });

    try {
      const res  = await fetch(`/api/documents/${documentId}/finding-actions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lens, matchKey, action, reason }),
      });
      const data = await res.json() as { ok: boolean; action?: ActionRecord; error?: { message: string } };
      if (data.ok && data.action) {
        setActions(prev => {
          const next = new Map(prev);
          next.set(compositeKey, {
            id:        data.action!.id,
            action:    data.action!.action,
            reason:    (data.action as unknown as { reason?: string | null }).reason ?? null,
            updatedAt: (data.action as unknown as { updatedAt: number }).updatedAt,
          });
          return next;
        });
      } else {
        // Revert optimistic update on failure
        setActions(prev => {
          const next = new Map(prev);
          if (previous) next.set(compositeKey, previous);
          else next.delete(compositeKey);
          return next;
        });
        setErrors(prev => {
          const next = new Map(prev);
          next.set(compositeKey, data.error?.message ?? 'Failed to save action');
          return next;
        });
      }
    } catch {
      // Revert on network error
      setActions(prev => {
        const next = new Map(prev);
        if (previous) next.set(compositeKey, previous);
        else next.delete(compositeKey);
        return next;
      });
      setErrors(prev => { const next = new Map(prev); next.set(compositeKey, 'Network error'); return next; });
    } finally {
      setBusyKeys(prev => { const next = new Set(prev); next.delete(compositeKey); return next; });
    }
  }, [documentId, actions]);

  const removeAction = useCallback(async (lens: string, matchKey: string) => {
    if (!documentId) return;
    const compositeKey = `${lens}:${matchKey}`;
    const previous     = actions.get(compositeKey);
    if (!previous) return;

    // Optimistic delete
    setActions(prev => { const next = new Map(prev); next.delete(compositeKey); return next; });
    setBusyKeys(prev => new Set([...prev, compositeKey]));
    setErrors(prev => { const next = new Map(prev); next.delete(compositeKey); return next; });

    try {
      const res  = await fetch(`/api/documents/${documentId}/finding-actions/${previous.id}`, { method: 'DELETE' });
      const data = await res.json() as { ok: boolean; error?: { message: string } };
      if (!data.ok) {
        // Revert
        setActions(prev => { const next = new Map(prev); next.set(compositeKey, previous); return next; });
        setErrors(prev => { const next = new Map(prev); next.set(compositeKey, data.error?.message ?? 'Failed to remove action'); return next; });
      }
    } catch {
      // Revert on network error
      setActions(prev => { const next = new Map(prev); next.set(compositeKey, previous); return next; });
      setErrors(prev => { const next = new Map(prev); next.set(compositeKey, 'Network error'); return next; });
    } finally {
      setBusyKeys(prev => { const next = new Set(prev); next.delete(compositeKey); return next; });
    }
  }, [documentId, actions]);

  return { actions, setAction, removeAction, busyKeys, errors };
}

// ---------------------------------------------------------------------------
// FindingActionBtns
// ---------------------------------------------------------------------------

interface FindingActionBtnsProps {
  lens:         string;
  matchKey:     string;
  documentId:   string | null | undefined;
  actionRecord: ActionRecord | undefined;
  busy:         boolean;
  setAction:    (lens: string, matchKey: string, action: string) => void;
  removeAction: (lens: string, matchKey: string) => void;
}

function FindingActionBtns({
  lens, matchKey, documentId, actionRecord, busy, setAction, removeAction,
}: FindingActionBtnsProps) {
  if (!documentId) return null;

  if (!actionRecord || actionRecord.action === 'reflagged') {
    return (
      <div class="flex items-center gap-2 mt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setAction(lens, matchKey, 'addressed')}
          class="text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40"
        >
          ✓ Mark addressed
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setAction(lens, matchKey, 'dismissed')}
          class="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (actionRecord.action === 'addressed') {
    return (
      <div class="flex items-center gap-2 mt-2">
        <span class="text-xs text-emerald-600 font-medium">✓ Marked as addressed</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => removeAction(lens, matchKey)}
          class="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          Re-flag
        </button>
      </div>
    );
  }

  // dismissed — only shown inside the dismissed expander, show Re-flag only
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => removeAction(lens, matchKey)}
      class="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 mt-2"
    >
      Re-flag
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToulminRow({ label, text }: { label: ComponentChildren; text: string }) {
  return (
    <div class="pl-4 border-l-2 border-indigo-200">
      <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd class="text-sm text-gray-700 leading-relaxed">{text}</dd>
    </div>
  );
}

interface FallacyCardProps {
  fallacy:      NamedFallacy;
  lens:         string;
  documentId:   string | null | undefined;
  versionId:    string | null | undefined;
  actionRecord: ActionRecord | undefined;
  busy:         boolean;
  setAction:    (lens: string, matchKey: string, action: string) => void;
  removeAction: (lens: string, matchKey: string) => void;
}

function FallacyCard({ fallacy, lens, documentId, versionId, actionRecord, busy, setAction, removeAction }: FallacyCardProps) {
  const cardCls   = SEVERITY_CARD[fallacy.severity] ?? 'bg-gray-50 border-gray-200';
  const matchKey  = fallacyMatchKey(fallacy);
  const addressed = actionRecord?.action === 'addressed';

  return (
    <div class={`rounded-xl border p-4 ${cardCls} ${addressed ? 'opacity-60' : ''}`}>
      <div class="flex items-start justify-between gap-2 mb-3">
        <p class="text-sm font-semibold text-gray-900">{fallacy.name}</p>
        <div class="flex items-center gap-1.5 shrink-0">
          {addressed && <AddressedBadge />}
          <ConfidenceBadge confidence={fallacy.confidence} />
          <SeverityBadge severity={fallacy.severity} />
        </div>
      </div>
      <blockquote class="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-3 mb-2 leading-relaxed">
        "{fallacy.quote}"
      </blockquote>
      <p class="text-xs text-gray-600 leading-relaxed">{fallacy.explanation}</p>
      <div class="flex items-start gap-3 flex-wrap">
        <FindingActionBtns
          lens={lens}
          matchKey={matchKey}
          documentId={documentId}
          actionRecord={actionRecord}
          busy={busy}
          setAction={setAction}
          removeAction={removeAction}
        />
        <FeedbackBtns
          documentId={documentId}
          versionId={versionId}
          targetLens="namedFallacies"
          matchKey={matchKey}
          findingSnapshot={fallacy}
        />
      </div>
    </div>
  );
}

interface LoadedLanguageRowProps {
  item:         LoadedLanguage;
  lens:         string;
  documentId:   string | null | undefined;
  versionId:    string | null | undefined;
  actionRecord: ActionRecord | undefined;
  busy:         boolean;
  setAction:    (lens: string, matchKey: string, action: string) => void;
  removeAction: (lens: string, matchKey: string) => void;
}

function LoadedLanguageRow({ item, lens, documentId, versionId, actionRecord, busy, setAction, removeAction }: LoadedLanguageRowProps) {
  const matchKey  = loadedLanguageMatchKey(item);
  const addressed = actionRecord?.action === 'addressed';

  return (
    <div class={`px-4 py-3 ${addressed ? 'opacity-60' : ''}`}>
      <div class="flex items-start gap-2 mb-1 flex-wrap">
        <span class="text-sm font-medium text-gray-900">"{item.phrase}"</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0 mt-0.5">
          {item.technique}
        </span>
        <div class="flex items-center gap-1 shrink-0 mt-0.5">
          {addressed && <AddressedBadge />}
          <ConfidenceBadge confidence={item.confidence} />
          <SeverityBadge severity={item.severity} />
        </div>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">{item.explanation}</p>
      <div class="flex items-start gap-3 flex-wrap">
        <FindingActionBtns
          lens={lens}
          matchKey={matchKey}
          documentId={documentId}
          actionRecord={actionRecord}
          busy={busy}
          setAction={setAction}
          removeAction={removeAction}
        />
        <FeedbackBtns
          documentId={documentId}
          versionId={versionId}
          targetLens="loadedLanguage"
          matchKey={matchKey}
          findingSnapshot={item}
        />
      </div>
    </div>
  );
}

interface WarrantRowProps {
  w:            UnstatedWarrant;
  lens:         string;
  documentId:   string | null | undefined;
  versionId:    string | null | undefined;
  actionRecord: ActionRecord | undefined;
  busy:         boolean;
  setAction:    (lens: string, matchKey: string, action: string) => void;
  removeAction: (lens: string, matchKey: string) => void;
}

function WarrantRow({ w, lens, documentId, versionId, actionRecord, busy, setAction, removeAction }: WarrantRowProps) {
  const matchKey  = unstatedWarrantMatchKey(w);
  const addressed = actionRecord?.action === 'addressed';

  return (
    <div class={`pl-4 border-l-2 border-indigo-200 ${addressed ? 'opacity-60' : ''}`}>
      <div class="flex items-start justify-between gap-2 mb-0.5">
        <p class="text-sm text-gray-700 leading-relaxed">{w.warrant}</p>
        <div class="flex items-center gap-1.5 shrink-0 mt-0.5">
          {addressed && <AddressedBadge />}
          <ConfidenceBadge confidence={w.confidence} />
          <SeverityBadge severity={w.severity} />
        </div>
      </div>
      <p class="text-xs text-gray-400 leading-snug italic">{w.necessity}</p>
      <div class="flex items-start gap-3 flex-wrap">
        <FindingActionBtns
          lens={lens}
          matchKey={matchKey}
          documentId={documentId}
          actionRecord={actionRecord}
          busy={busy}
          setAction={setAction}
          removeAction={removeAction}
        />
        <FeedbackBtns
          documentId={documentId}
          versionId={versionId}
          targetLens="unstatedWarrants"
          matchKey={matchKey}
          findingSnapshot={w}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DismissedToggle
// ---------------------------------------------------------------------------

function DismissedToggle({ count, expanded, onToggle }: { count: number; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      class="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
    >
      {expanded ? `Hide dismissed (${count})` : `Show dismissed (${count})`}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function AuditResults({ result, documentId, versionId, initialActions }: Props) {
  const { actions, setAction, removeAction, busyKeys } = useActionState(documentId, initialActions);

  const [showDismissedFallacies, setShowDismissedFallacies]     = useState(false);
  const [showDismissedLoadedLang, setShowDismissedLoadedLang]   = useState(false);
  const [showDismissedWarrants,   setShowDismissedWarrants]     = useState(false);

  const LENS = 'audit';

  function getAction(key: string): ActionRecord | undefined {
    return actions.get(`${LENS}:${key}`);
  }
  function isBusy(key: string): boolean {
    return busyKeys.has(`${LENS}:${key}`);
  }

  // Partition fallacies
  const activeFallacies    = sortByPriority(result.namedFallacies.filter(f => {
    const rec = getAction(fallacyMatchKey(f));
    return !rec || rec.action !== 'dismissed';
  }));
  const dismissedFallacies = result.namedFallacies.filter(f => {
    const rec = getAction(fallacyMatchKey(f));
    return rec?.action === 'dismissed';
  });

  // Partition loaded language
  const activeLoadedLang    = sortByPriority(result.loadedLanguage.filter(l => {
    const rec = getAction(loadedLanguageMatchKey(l));
    return !rec || rec.action !== 'dismissed';
  }));
  const dismissedLoadedLang = result.loadedLanguage.filter(l => {
    const rec = getAction(loadedLanguageMatchKey(l));
    return rec?.action === 'dismissed';
  });

  // Partition warrants
  const activeWarrants    = sortByPriority(result.toulmin.unstatedWarrants.filter(w => {
    const rec = getAction(unstatedWarrantMatchKey(w));
    return !rec || rec.action !== 'dismissed';
  }));
  const dismissedWarrants = result.toulmin.unstatedWarrants.filter(w => {
    const rec = getAction(unstatedWarrantMatchKey(w));
    return rec?.action === 'dismissed';
  });

  const hasFindings = activeFallacies.length > 0 || activeLoadedLang.length > 0 ||
    dismissedFallacies.length > 0 || dismissedLoadedLang.length > 0;

  return (
    <div class="space-y-8 border-t border-gray-100 pt-8">

      {/* Central claim */}
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-2">
          <LabelWithTooltip label="centralClaim" />
        </p>
        <p class="text-gray-900 text-base leading-relaxed">{result.centralClaim}</p>
      </div>

      {/* Toulmin breakdown */}
      <section>
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          <LabelWithTooltip label="toulmin" />
        </h2>

        <dl class="space-y-4">
          <ToulminRow label={<LabelWithTooltip label="toulminClaim" />}   text={result.toulmin.claim} />
          <ToulminRow label={<LabelWithTooltip label="toulminGrounds" />} text={result.toulmin.grounds} />
          {result.toulmin.statedWarrant && (
            <ToulminRow label={<LabelWithTooltip label="toulminWarrant" />} text={result.toulmin.statedWarrant} />
          )}

          {(activeWarrants.length > 0 || dismissedWarrants.length > 0) && (
            <div>
              <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                <LabelWithTooltip label="unstatedWarrants" />
              </dt>
              <dd class="space-y-3">
                {activeWarrants.map((w, i) => (
                  <WarrantRow
                    key={i}
                    w={w}
                    lens={LENS}
                    documentId={documentId}
                    versionId={versionId}
                    actionRecord={getAction(unstatedWarrantMatchKey(w))}
                    busy={isBusy(unstatedWarrantMatchKey(w))}
                    setAction={setAction}
                    removeAction={removeAction}
                  />
                ))}
                {dismissedWarrants.length > 0 && (
                  <>
                    <DismissedToggle
                      count={dismissedWarrants.length}
                      expanded={showDismissedWarrants}
                      onToggle={() => setShowDismissedWarrants(v => !v)}
                    />
                    {showDismissedWarrants && (
                      <div class="space-y-3 mt-2 opacity-50">
                        {dismissedWarrants.map((w, i) => (
                          <WarrantRow
                            key={i}
                            w={w}
                            lens={LENS}
                            documentId={documentId}
                            versionId={versionId}
                            actionRecord={getAction(unstatedWarrantMatchKey(w))}
                            busy={isBusy(unstatedWarrantMatchKey(w))}
                            setAction={setAction}
                            removeAction={removeAction}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </dd>
            </div>
          )}

          <div class="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <dt class="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              <LabelWithTooltip label="weakestLink" />
            </dt>
            <dd class="text-sm text-amber-900 leading-relaxed">{result.toulmin.weakestLink}</dd>
          </div>
        </dl>
      </section>

      {/* Findings or empty state */}
      {!hasFindings ? (
        <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
          <p class="text-sm text-emerald-700">
            No reasoning patterns or loaded language detected — the argument's structural integrity
            is the focus of the analysis above.
          </p>
        </div>
      ) : (
        <>
          {(activeFallacies.length > 0 || dismissedFallacies.length > 0) && (
            <section>
              <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                <LabelWithTooltip label="namedFallacies" />
              </h2>
              <div class="space-y-3">
                {activeFallacies.map((f, i) => (
                  <FallacyCard
                    key={i}
                    fallacy={f}
                    lens={LENS}
                    documentId={documentId}
                    versionId={versionId}
                    actionRecord={getAction(fallacyMatchKey(f))}
                    busy={isBusy(fallacyMatchKey(f))}
                    setAction={setAction}
                    removeAction={removeAction}
                  />
                ))}
                {dismissedFallacies.length > 0 && (
                  <>
                    <DismissedToggle
                      count={dismissedFallacies.length}
                      expanded={showDismissedFallacies}
                      onToggle={() => setShowDismissedFallacies(v => !v)}
                    />
                    {showDismissedFallacies && (
                      <div class="space-y-3 mt-2 opacity-50">
                        {dismissedFallacies.map((f, i) => (
                          <FallacyCard
                            key={i}
                            fallacy={f}
                            lens={LENS}
                            documentId={documentId}
                            versionId={versionId}
                            actionRecord={getAction(fallacyMatchKey(f))}
                            busy={isBusy(fallacyMatchKey(f))}
                            setAction={setAction}
                            removeAction={removeAction}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {(activeLoadedLang.length > 0 || dismissedLoadedLang.length > 0) && (
            <section>
              <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                <LabelWithTooltip label="loadedLanguage" />
              </h2>
              <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div class="divide-y divide-gray-100">
                  {activeLoadedLang.map((item, i) => (
                    <LoadedLanguageRow
                      key={i}
                      item={item}
                      lens={LENS}
                      documentId={documentId}
                      versionId={versionId}
                      actionRecord={getAction(loadedLanguageMatchKey(item))}
                      busy={isBusy(loadedLanguageMatchKey(item))}
                      setAction={setAction}
                      removeAction={removeAction}
                    />
                  ))}
                </div>
                {dismissedLoadedLang.length > 0 && (
                  <div class="px-4 pb-3">
                    <DismissedToggle
                      count={dismissedLoadedLang.length}
                      expanded={showDismissedLoadedLang}
                      onToggle={() => setShowDismissedLoadedLang(v => !v)}
                    />
                    {showDismissedLoadedLang && (
                      <div class="mt-2 opacity-50 divide-y divide-gray-100">
                        {dismissedLoadedLang.map((item, i) => (
                          <LoadedLanguageRow
                            key={i}
                            item={item}
                            lens={LENS}
                            documentId={documentId}
                            versionId={versionId}
                            actionRecord={getAction(loadedLanguageMatchKey(item))}
                            busy={isBusy(loadedLanguageMatchKey(item))}
                            setAction={setAction}
                            removeAction={removeAction}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
