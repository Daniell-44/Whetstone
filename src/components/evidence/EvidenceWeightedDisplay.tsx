import { useState } from 'preact/hooks';
import type { EvidenceWeightedResult, EvidenceAssessment, EvidencePaper } from '../../../functions/_lib/evidence-weighted/types';

// ---------------------------------------------------------------------------
// Consensus-level styling
// ---------------------------------------------------------------------------

const CONSENSUS_BADGE: Record<string, { label: string; cls: string }> = {
  strong_support:      { label: 'Strong support',      cls: 'bg-emerald-100 text-emerald-700' },
  moderate_support:    { label: 'Moderate support',    cls: 'bg-green-100 text-green-700' },
  contested:           { label: 'Contested',           cls: 'bg-amber-100 text-amber-700' },
  moderate_opposition: { label: 'Moderate opposition', cls: 'bg-orange-100 text-orange-700' },
  strong_opposition:   { label: 'Strong opposition',   cls: 'bg-red-100 text-red-700' },
  insufficient_data:   { label: 'Not enough data',     cls: 'bg-gray-100 text-gray-600' },
  not_applicable:      { label: 'Not empirical',       cls: 'bg-violet-100 text-violet-700' },
};

const CLAIM_TYPE_LABEL: Record<string, string> = {
  empirical_contested:   'Empirical (contested)',
  empirical_uncontested: 'Empirical',
  normative:             'Value / normative',
  definitional:          'Definitional',
  modal_predictive:      'Predictive',
};

// ---------------------------------------------------------------------------
// Consensus.com-style breakdown bar (supports / mixed-neutral / opposes)
// ---------------------------------------------------------------------------

function ConsensusBar({ papers }: { papers: EvidencePaper[] }) {
  const counts = papers.reduce((acc, p) => {
    if (p.stance === 'supports') acc.supports += 1;
    else if (p.stance === 'opposes') acc.opposes += 1;
    else acc.mixed += 1;
    return acc;
  }, { supports: 0, mixed: 0, opposes: 0 });

  const total = counts.supports + counts.mixed + counts.opposes;
  if (total === 0) return null;

  const supportPct = (counts.supports / total) * 100;
  const mixedPct   = (counts.mixed    / total) * 100;
  const opposePct  = (counts.opposes  / total) * 100;

  return (
    <div class="space-y-1.5">
      <div class="flex h-2 rounded-full overflow-hidden bg-gray-100">
        {counts.supports > 0 && (
          <div class="bg-emerald-500 transition-all" style={`width: ${supportPct}%`} title={`${counts.supports} supports`} />
        )}
        {counts.mixed > 0 && (
          <div class="bg-amber-400 transition-all" style={`width: ${mixedPct}%`} title={`${counts.mixed} mixed / neutral`} />
        )}
        {counts.opposes > 0 && (
          <div class="bg-red-500 transition-all" style={`width: ${opposePct}%`} title={`${counts.opposes} oppose`} />
        )}
      </div>
      <div class="flex items-center gap-3 text-[10px] text-gray-500">
        {counts.supports > 0 && (
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500" />
            {counts.supports} support{counts.supports !== 1 ? 's' : ''}
          </span>
        )}
        {counts.mixed > 0 && (
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-amber-400" />
            {counts.mixed} mixed
          </span>
        )}
        {counts.opposes > 0 && (
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-red-500" />
            {counts.opposes} oppose{counts.opposes !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence ring (small, 28px)
// ---------------------------------------------------------------------------

function ConfidenceRing({ pct }: { pct: number }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const colour = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : pct >= 25 ? '#f97316' : '#ef4444';
  return (
    <div class="relative inline-flex items-center justify-center shrink-0" style="width:28px;height:28px;">
      <svg width="28" height="28" class="-rotate-90">
        <circle cx="14" cy="14" r={radius} fill="none" stroke="#f3f4f6" stroke-width="3" />
        <circle cx="14" cy="14" r={radius} fill="none" stroke={colour} stroke-width="3" stroke-linecap="round" stroke-dasharray={circumference} stroke-dashoffset={offset} />
      </svg>
      <span class="absolute text-[9px] font-bold" style={`color:${colour}`}>{pct}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One assessment card
// ---------------------------------------------------------------------------

function AssessmentCard({ a }: { a: EvidenceAssessment }) {
  const [expanded, setExpanded] = useState(false);
  const badge = CONSENSUS_BADGE[a.consensusLevel];
  const claimTypeLabel = CLAIM_TYPE_LABEL[a.claimType] ?? a.claimType;
  const isEmpirical = a.claimType === 'empirical_contested' || a.claimType === 'empirical_uncontested';

  return (
    <div class="rounded-lg border border-gray-200 bg-white p-3 space-y-2.5">
      {/* Claim */}
      <div class="flex items-start gap-2.5">
        {isEmpirical && a.confidencePercent !== null && (
          <ConfidenceRing pct={a.confidencePercent} />
        )}
        <div class="flex-1 min-w-0">
          <p class="text-xs leading-snug text-gray-800">{a.claim}</p>
          <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span class={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${badge?.cls ?? 'bg-gray-100 text-gray-500'}`}>
              {badge?.label ?? a.consensusLevel}
            </span>
            <span class="text-[9px] text-gray-400">{claimTypeLabel}</span>
            {a.paperCount > 0 && (
              <span class="text-[9px] text-gray-400">· {a.paperCount} paper{a.paperCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>

      {/* Consensus bar (only when we have papers) */}
      {a.topPapers.length > 0 && (
        <ConsensusBar papers={a.topPapers} />
      )}

      {/* Explanation */}
      <p class="text-[11px] text-gray-600 leading-relaxed">{a.explanation}</p>

      {/* Caveats */}
      {a.caveats && (
        <p class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-snug">
          <strong class="font-semibold">Caveat:</strong> {a.caveats}
        </p>
      )}

      {/* Top papers — expandable */}
      {a.topPapers.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            class="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
          >
            {expanded ? 'Hide papers ↑' : `View ${a.topPapers.length} paper${a.topPapers.length !== 1 ? 's' : ''} ↓`}
          </button>
          {expanded && (
            <div class="space-y-1.5 pt-1 border-t border-gray-100">
              {a.topPapers.map((p, i) => <PaperRow key={i} p={p} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const STANCE_BADGE: Record<string, string> = {
  supports: 'bg-emerald-100 text-emerald-700',
  opposes:  'bg-red-100 text-red-700',
  mixed:    'bg-amber-100 text-amber-700',
  neutral:  'bg-gray-100 text-gray-500',
};

function PaperRow({ p }: { p: EvidencePaper }) {
  return (
    <div class="flex items-start gap-2 py-1.5">
      <span class={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${STANCE_BADGE[p.stance] ?? STANCE_BADGE.neutral}`}>
        {p.stance}
      </span>
      <div class="flex-1 min-w-0">
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          class="text-[11px] text-blue-600 hover:underline font-medium leading-snug block"
        >
          {p.title}
        </a>
        <p class="text-[10px] text-gray-400 mt-0.5">
          {p.year ?? 'n.d.'} · {p.citationCount.toLocaleString()} citation{p.citationCount !== 1 ? 's' : ''}
        </p>
        <p class="text-[10px] text-gray-500 mt-0.5 leading-snug italic">{p.relevance}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main display
// ---------------------------------------------------------------------------

export default function EvidenceWeightedDisplay({ result }: { result: EvidenceWeightedResult }) {
  if (result.assessments.length === 0) {
    return <p class="text-xs text-gray-400 italic">No empirical claims to assess.</p>;
  }
  return (
    <div class="space-y-3">
      {result.assessments.map((a, i) => (
        <AssessmentCard key={i} a={a} />
      ))}
      {result.notes && (
        <p class="text-[10px] text-gray-400 italic border-t border-gray-100 pt-2">{result.notes}</p>
      )}
    </div>
  );
}
