import { useState, useCallback } from 'preact/hooks';
import type { CitationAuditResult, CitedClaim, CitationVerdict } from '../../../functions/_lib/citation-audit/types';
import { citationMatchKey } from '../../../functions/_lib/audit/match-keys';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import type { TerminologyPreference } from '../../lib/labels';
import GroundednessChip from '../grounded/GroundednessChip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionRecord = { id: string; action: string; reason?: string | null; updatedAt: number };
type ActionsMap   = Map<string, ActionRecord>;

interface Props {
  result:                 CitationAuditResult;
  documentId?:            string | null;
  versionId?:             string | null;
  initialActions?:        Record<string, { id: string; action: string; reason?: string | null; updatedAt: number }>;
  terminologyPreference?: TerminologyPreference;
}

// ---------------------------------------------------------------------------
// Verdict colours and labels
// ---------------------------------------------------------------------------

const VERDICT_COLOURS: Record<CitationVerdict, string> = {
  well_cited:   'bg-emerald-100 text-emerald-800 border-emerald-200',
  weakly_cited: 'bg-amber-100  text-amber-800  border-amber-200',
  mismatched:   'bg-red-100    text-red-800    border-red-200',
  uncited:      'bg-hairline/40   text-ink   border-hairline',
  unfetchable:  'bg-hairline/40   text-muted   border-dashed border-hairline',
  non_factual:  'bg-purple-50  text-purple-700 border-purple-200',
};

const VERDICT_CARD: Record<CitationVerdict, string> = {
  well_cited:   'border-emerald-200 bg-emerald-50',
  weakly_cited: 'border-amber-200  bg-amber-50',
  mismatched:   'border-red-200    bg-red-50',
  uncited:      'border-hairline   bg-paper',
  unfetchable:  'border-dashed border-hairline bg-paper',
  non_factual:  'border-purple-200 bg-purple-50',
};

const VERDICT_LABEL: Record<CitationVerdict, string> = {
  well_cited:   'Well cited',
  weakly_cited: 'Weakly cited',
  mismatched:   'Mismatched',
  uncited:      'No source',
  unfetchable:  'Unreachable',
  non_factual:  'Not factual',
};

// ---------------------------------------------------------------------------
// Summary pill helper
// ---------------------------------------------------------------------------

function SummaryPill({ count, label, colour }: { count: number; label: string; colour: string }) {
  if (count === 0) return null;
  return (
    <div class={`flex flex-col items-center rounded-xl border px-3 py-2 min-w-[4rem] ${colour}`}>
      <span class="text-lg font-bold leading-none">{count}</span>
      <span class="text-xs mt-0.5 font-medium leading-tight text-center">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-claim card
// ---------------------------------------------------------------------------

function ClaimCard({
  claim,
  matchKey,
  documentId,
  versionId,
  actionsMap,
  onAction,
}: {
  claim:      CitedClaim;
  matchKey:   string;
  documentId: string | null;
  versionId:  string | null;
  actionsMap: ActionsMap;
  onAction:   (key: string, action: string) => void;
}) {
  const [excerptOpen, setExcerptOpen] = useState(false);
  const action = actionsMap.get(matchKey);

  const cardCls = VERDICT_CARD[claim.verdict] ?? 'border-hairline bg-paper';
  const badgeCls = VERDICT_COLOURS[claim.verdict] ?? 'bg-hairline/40 text-ink border-hairline';

  return (
    <div class={`rounded-xl border p-4 space-y-2 ${cardCls} ${action?.action === 'addressed' || action?.action === 'dismissed' ? 'opacity-50' : ''}`}>
      {/* Header: verdict badge + confidence */}
      <div class="flex items-start gap-2 flex-wrap">
        <span class={`text-xs px-2 py-0.5 rounded-full font-semibold border shrink-0 ${badgeCls}`}>
          {VERDICT_LABEL[claim.verdict]}
        </span>
        <span class="ml-auto shrink-0"><GroundednessChip groundedness={claim.groundedness} compact /></span>
      </div>

      {/* Claim text */}
      <p class="text-sm font-medium text-ink leading-snug">{claim.claim}</p>

      {/* Verdict explanation */}
      <p class="text-xs text-ink leading-relaxed">{claim.verdictExplanation}</p>

      {/* Citation URL */}
      {claim.citationUrl && (
        <a
          href={claim.citationUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="block text-xs text-accent hover:underline truncate"
        >
          {claim.citationUrl}
        </a>
      )}

      {/* Source excerpt toggle */}
      {claim.sourceExcerpt && (
        <div>
          <button
            type="button"
            onClick={() => setExcerptOpen(o => !o)}
            class="text-xs text-muted underline decoration-dotted hover:text-ink"
          >
            {excerptOpen ? 'Hide source excerpt' : 'View source excerpt'}
          </button>
          {excerptOpen && (
            <blockquote class="mt-1.5 border-l-2 border-hairline pl-3 text-xs text-ink italic leading-relaxed">
              {claim.sourceExcerpt}
            </blockquote>
          )}
        </div>
      )}

      {/* Finding actions (accept / dismiss / addressed + thumbs) */}
      {documentId && versionId && (
        <div class="flex items-center gap-2 pt-1 flex-wrap">
          {(['addressed', 'dismissed'] as const).map(act => (
            <button
              key={act}
              type="button"
              onClick={() => onAction(matchKey, act)}
              class={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                action?.action === act
                  ? 'bg-ink text-white border-hairline'
                  : 'border-hairline text-muted hover:border-muted'
              }`}
            >
              {act === 'addressed' ? 'Addressed' : 'Dismiss'}
            </button>
          ))}
          <div class="flex gap-1 ml-auto">
            {(['accept', 'reject'] as const).map(vote => (
              <button
                key={vote}
                type="button"
                onClick={() => onAction(matchKey, vote)}
                class={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                  action?.action === vote
                    ? 'bg-ink text-white border-hairline'
                    : 'border-hairline text-muted hover:border-muted'
                }`}
              >
                {vote === 'accept' ? '👍' : '👎'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main display component
// ---------------------------------------------------------------------------

export default function CitationAuditDisplay({
  result,
  documentId  = null,
  versionId   = null,
  initialActions = {},
  terminologyPreference,
}: Props) {
  const [actionsMap, setActionsMap] = useState<ActionsMap>(
    () => new Map(Object.entries(initialActions)),
  );

  const handleAction = useCallback(async (matchKey: string, action: string) => {
    // Optimistic update
    setActionsMap(prev => {
      const next = new Map(prev);
      next.set(matchKey, { id: matchKey, action, updatedAt: Date.now() });
      return next;
    });

    if (!documentId) return;
    try {
      await fetch(`/api/documents/${documentId}/finding-actions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ matchKey, action, versionId }),
      });
    } catch { /* best-effort */ }
  }, [documentId, versionId]);

  const { summary, factualClaims, notes } = result;

  // Non-factual claims are shown only for analyst context, not in the default list
  const userFacingClaims = factualClaims.filter(c => c.verdict !== 'non_factual');

  return (
    <div class="space-y-5">
      {/* Section header */}
      <h3 class="text-xs font-semibold uppercase tracking-widest text-muted">
        <LabelWithTooltip label="citationAudit" preference={terminologyPreference} />
      </h3>

      {/* Summary card */}
      <div class="rounded-xl border border-hairline bg-surface p-4">
        <p class="text-xs text-muted font-medium mb-3">
          {summary.total} factual claim{summary.total !== 1 ? 's' : ''} found
        </p>
        <div class="flex flex-wrap gap-2">
          <SummaryPill count={summary.mismatched}  label="Mismatched"   colour="bg-red-50    border-red-200    text-red-800" />
          <SummaryPill count={summary.uncited}     label="Uncited"      colour="bg-hairline/40  border-hairline   text-ink" />
          <SummaryPill count={summary.unfetchable} label="Unreachable"  colour="bg-paper   border-dashed border-hairline text-muted" />
          <SummaryPill count={summary.weaklyCited} label="Weak"         colour="bg-amber-50  border-amber-200  text-amber-800" />
          <SummaryPill count={summary.wellCited}   label="Well cited"   colour="bg-emerald-50 border-emerald-200 text-emerald-800" />
        </div>
      </div>

      {/* Analyst notes */}
      {notes && (
        <p class="text-xs text-muted italic leading-relaxed">{notes}</p>
      )}

      {/* Per-claim cards */}
      {userFacingClaims.length === 0 ? (
        <p class="text-sm text-muted italic">No factual claims were identified in this draft.</p>
      ) : (
        <div class="space-y-3">
          {userFacingClaims.map(claim => {
            const key = citationMatchKey(claim);
            return (
              <ClaimCard
                key={key}
                claim={claim}
                matchKey={key}
                documentId={documentId}
                versionId={versionId}
                actionsMap={actionsMap}
                onAction={handleAction}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
