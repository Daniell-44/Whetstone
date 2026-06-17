import { useState, useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { ArgumentExtractionResult, ExtractionStatement } from '../../lib/extraction';
import type { TerminologyPreference } from '../../lib/labels';
import type { EvidenceAssessment } from '../../../functions/_lib/evidence-weighted/types';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import ArgumentFlowChart from './ArgumentFlowChart';
import GroundednessChip from '../grounded/GroundednessChip';

// ---------------------------------------------------------------------------
// Consensus badge - small chip on statement cards for empirical claims
// ---------------------------------------------------------------------------

const CONSENSUS_CHIP: Record<string, { label: string; cls: string }> = {
  strong_support:      { label: '✓ Strong support',      cls: 'bg-emerald-100 text-emerald-700' },
  moderate_support:    { label: '✓ Moderate support',    cls: 'bg-green-100 text-green-700' },
  contested:           { label: '⇄ Contested',           cls: 'bg-amber-100 text-amber-700' },
  moderate_opposition: { label: '⤬ Moderate opposition', cls: 'bg-orange-100 text-orange-700' },
  strong_opposition:   { label: '⤬ Strong opposition',   cls: 'bg-red-100 text-red-700' },
  insufficient_data:   { label: '? Insufficient data',   cls: 'bg-gray-100 text-gray-600' },
  not_applicable:      { label: 'Not empirical',          cls: 'bg-violet-100 text-violet-700' },
};

function ConsensusChip({ assessment }: { assessment: EvidenceAssessment }) {
  const chip = CONSENSUS_CHIP[assessment.consensusLevel];
  if (!chip) return null;
  return (
    <span
      class={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${chip.cls}`}
      title={assessment.explanation}
    >
      {chip.label}
      {assessment.confidencePercent !== null && (
        <span class="opacity-70 ml-1">{assessment.confidencePercent}%</span>
      )}
    </span>
  );
}

// Try to match an extracted statement to its evidence assessment by text similarity.
// The evidence API is fed `text` directly so we can match on exact equality first,
// then a permissive prefix fallback.
function matchAssessment(stmt: ExtractionStatement, assessments?: EvidenceAssessment[]): EvidenceAssessment | undefined {
  if (!assessments || assessments.length === 0) return undefined;
  const exact = assessments.find(a => a.claim === stmt.text);
  if (exact) return exact;
  // Permissive: first 60 chars
  const prefix = stmt.text.slice(0, 60);
  return assessments.find(a => a.claim.startsWith(prefix) || prefix.startsWith(a.claim.slice(0, 60)));
}

// ---------------------------------------------------------------------------
// Inference rule pretty-printing
// ---------------------------------------------------------------------------

const INFERENCE_LABELS: Record<string, string> = {
  modus_ponens:           'Modus ponens',
  modus_tollens:          'Modus tollens',
  hypothetical_syllogism: 'Hypothetical syllogism',
  disjunctive_syllogism:  'Disjunctive syllogism',
  categorical_syllogism:  'Categorical syllogism',
  inductive_generalisation: 'Inductive generalisation',
  abduction:              'Abduction',
  analogy:                'Analogy',
  other:                  'Other',
};

// ---------------------------------------------------------------------------
// View modes
// ---------------------------------------------------------------------------

type View = 'diagram' | 'inverted' | 'detailed';

// Top-down is the default reading view; Visualise (diagram) is the toggle.
// The old "Detailed" view is retired (folded into the top-down reading).
const VIEW_OPTIONS: { id: View; label: string; hint: string }[] = [
  { id: 'inverted', label: 'Top-down',  hint: 'Conclusion first, supporting premises nested below' },
  { id: 'diagram',  label: 'Visualise', hint: 'Visual flow chart of premises and conclusions' },
];

// ---------------------------------------------------------------------------
// Statement card - used in Detailed view
// ---------------------------------------------------------------------------

function StatementCard({ stmt, assessment }: {
  stmt: ExtractionStatement;
  assessment?: EvidenceAssessment;
}) {
  const isPremise = stmt.type === 'premise';
  const isImplicit = stmt.text.startsWith('★') || stmt.id.startsWith('★');

  return (
    <div class={`rounded-lg border p-4 ${isPremise ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
      <div class="flex items-start gap-3">
        <span class={`font-mono text-sm font-semibold shrink-0 mt-0.5 ${isPremise ? 'text-gray-500' : 'text-blue-600'}`}>
          {stmt.id}
        </span>
        <div class="flex-1 min-w-0">
          <p class={`text-sm ${isImplicit ? 'italic text-gray-600' : 'text-gray-800'}`}>
            {stmt.text}
          </p>
          {assessment && (
            <div class="mt-2">
              <ConsensusChip assessment={assessment} />
            </div>
          )}
          {!isPremise && stmt.derivedFrom && stmt.derivedFrom.length > 0 && (
            <p class="mt-1.5 text-xs text-blue-500">
              ∴ from {stmt.derivedFrom.join(', ')}
            </p>
          )}
          {stmt.inferenceRule && (
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {INFERENCE_LABELS[stmt.inferenceRule] ?? stmt.inferenceRule}
              </span>
              {stmt.inferenceRuleExplanation && (
                <span class="text-xs text-gray-500">{stmt.inferenceRuleExplanation}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inverted view - conclusion at the top, premises nested as support beneath
//
// Pattern adopted: "inverted pyramid" from newspaper headlines, mapped to
// arguments - the thesis (terminal conclusion) is stated first, then the
// premises that derive it are unpacked underneath, recursively for sub-claims.
// This mirrors how a careful reader actually inspects an argument: "what's
// the conclusion?" → "what supports it?" → "what supports those?"
// ---------------------------------------------------------------------------

function buildSupportTree(statements: ExtractionStatement[]): ExtractionStatement[] {
  // Find terminal conclusions (no other statement derives FROM them as a source)
  const derivedFromIds = new Set<string>();
  for (const s of statements) {
    if (s.derivedFrom) {
      for (const id of s.derivedFrom) derivedFromIds.add(id);
    }
  }
  return statements.filter(s => s.type === 'conclusion' && !derivedFromIds.has(s.id));
}

function InvertedNode({
  stmt,
  statements,
  depth,
  visited,
  evidenceAssessments,
}: {
  stmt:                ExtractionStatement;
  statements:          ExtractionStatement[];
  depth:               number;
  visited:             Set<string>;
  evidenceAssessments?: EvidenceAssessment[];
}) {
  if (visited.has(stmt.id)) return null; // guard against cycles
  visited.add(stmt.id);

  const isImplicit = stmt.text.startsWith('★') || stmt.id.startsWith('★');
  const isConclusion = stmt.type === 'conclusion';

  // Resolve the IDs this statement derives from
  const sources = (stmt.derivedFrom ?? [])
    .map(id => statements.find(s => s.id === id))
    .filter((s): s is ExtractionStatement => s !== undefined);

  const assessment = matchAssessment(stmt, evidenceAssessments);

  return (
    <div class={depth === 0 ? '' : 'pl-4 sm:pl-5 border-l-2 border-gray-200 ml-2'}>
      <div class={`rounded-lg p-3 sm:p-4 ${
        depth === 0
          ? 'bg-blue-50 border-2 border-blue-300 shadow-sm'
          : isConclusion
            ? 'bg-blue-50 border border-blue-200'
            : 'bg-gray-50 border border-gray-200'
      }`}>
        <div class="flex items-start gap-2 sm:gap-3">
          <span class={`font-mono text-xs font-semibold shrink-0 mt-0.5 ${
            depth === 0 ? 'text-blue-700' : isConclusion ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {stmt.id}
          </span>
          <div class="flex-1 min-w-0">
            <p class={`${depth === 0 ? 'text-base font-semibold' : 'text-sm'} ${
              isImplicit ? 'italic text-gray-600' : 'text-gray-800'
            }`}>
              {stmt.text}
            </p>
            {assessment && (
              <div class="mt-1.5">
                <ConsensusChip assessment={assessment} />
              </div>
            )}
            {stmt.inferenceRule && (
              <p class="mt-1 text-[10px] text-blue-500 uppercase tracking-wide">
                via {INFERENCE_LABELS[stmt.inferenceRule] ?? stmt.inferenceRule}
              </p>
            )}
            {stmt.inferenceRuleExplanation && (
              <p class="mt-0.5 text-[11px] text-gray-500 italic">{stmt.inferenceRuleExplanation}</p>
            )}
          </div>
        </div>
      </div>

      {/* Recurse into the premises supporting this statement */}
      {sources.length > 0 && (
        <div class="mt-2 space-y-2">
          <p class="text-[10px] text-gray-400 uppercase tracking-wider pl-2">supported by</p>
          {sources.map(src => (
            <InvertedNode
              key={`${stmt.id}-${src.id}`}
              stmt={src}
              statements={statements}
              depth={depth + 1}
              visited={visited}
              evidenceAssessments={evidenceAssessments}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvertedView({ result, evidenceAssessments }: {
  result: ArgumentExtractionResult;
  evidenceAssessments?: EvidenceAssessment[];
}) {
  const terminalConclusions = buildSupportTree(result.statements);
  const orphans = result.statements.filter(s =>
    s.type === 'premise'
    && !result.statements.some(c => c.derivedFrom?.includes(s.id))
  );

  if (terminalConclusions.length === 0) {
    return (
      <div class="space-y-2">
        <p class="text-xs text-gray-400 italic">No terminal conclusion identified - listing all statements:</p>
        {result.statements.map(s => (
          <StatementCard key={s.id} stmt={s} assessment={matchAssessment(s, evidenceAssessments)} />
        ))}
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {terminalConclusions.map(c => (
        <InvertedNode
          key={c.id}
          stmt={c}
          statements={result.statements}
          depth={0}
          visited={new Set()}
          evidenceAssessments={evidenceAssessments}
        />
      ))}
      {orphans.length > 0 && (
        <div class="pt-2 border-t border-gray-100">
          <p class="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Standalone premises (not used in derivations)</p>
          <div class="space-y-2">
            {orphans.map(s => (
              <StatementCard key={s.id} stmt={s} assessment={matchAssessment(s, evidenceAssessments)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detailed view - the original numbered-list layout
// ---------------------------------------------------------------------------

function DetailedView({ result, terminologyPreference, evidenceAssessments }: {
  result: ArgumentExtractionResult;
  terminologyPreference?: TerminologyPreference;
  evidenceAssessments?: EvidenceAssessment[];
}) {
  const premises    = result.statements.filter(s => s.type === 'premise');
  const conclusions = result.statements.filter(s => s.type === 'conclusion');
  return (
    <div class="space-y-6">
      {premises.length > 0 && (
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <LabelWithTooltip label="extractionPremise" preference={terminologyPreference} />
          </p>
          <div class="space-y-2">
            {premises.map(stmt => <StatementCard key={stmt.id} stmt={stmt} assessment={matchAssessment(stmt, evidenceAssessments)} />)}
          </div>
        </div>
      )}
      {conclusions.length > 0 && (
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <LabelWithTooltip label="extractionConclusion" preference={terminologyPreference} />
          </p>
          <div class="space-y-2">
            {conclusions.map(stmt => <StatementCard key={stmt.id} stmt={stmt} assessment={matchAssessment(stmt, evidenceAssessments)} />)}
          </div>
        </div>
      )}
      {result.notes && (
        <p class="text-xs text-gray-500 italic border-t border-gray-100 pt-3">{result.notes}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expand modal - full-viewport diagram for visual inspection
// ---------------------------------------------------------------------------

function ExpandModal({
  result,
  onClose,
}: {
  result:   ArgumentExtractionResult;
  onClose:  () => void;
}) {
  // Escape-to-close + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div class="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col">
      <div class="border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div>
          <p class="text-[10px] font-semibold tracking-widest text-emerald-600 uppercase">Argument Skeleton</p>
          <p class="text-sm font-medium text-gray-900 truncate max-w-2xl">{result.centralClaim}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          Close
        </button>
      </div>
      <div class="flex-1 overflow-auto p-4 sm:p-8">
        <ArgumentFlowChart result={result} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  result:                 ArgumentExtractionResult;
  terminologyPreference?: TerminologyPreference;
  evidenceAssessments?:   EvidenceAssessment[];
}

export default function ArgumentExtraction({ result, terminologyPreference, evidenceAssessments }: Props) {
  const [view, setView]   = useState<View>('inverted');
  const [expanded, setExpanded] = useState(false);
  const isEmpty = result.statements.length === 0;

  return (
    <div class="space-y-4">
      {/* Central claim */}
      <div>
        <p class="text-sm font-semibold text-gray-700 mb-1">
          <LabelWithTooltip label="extraction" preference={terminologyPreference} />
        </p>
        <p class="text-base text-gray-900 font-medium leading-snug">{result.centralClaim}</p>
        <span class="inline-block mt-1"><GroundednessChip groundedness={result.groundedness} compact /></span>
      </div>

      {/* View toggle + expand */}
      {!isEmpty && (
        <div class="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
          <div class="flex gap-0.5 overflow-x-auto -mx-1 px-1 scrollbar-thin">
            {VIEW_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setView(opt.id)}
                title={opt.hint}
                class={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  view === opt.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {view === 'diagram' && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              class="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              title="Open the diagram in a full-screen view"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
              Expand
            </button>
          )}
        </div>
      )}

      {/* Body */}
      {isEmpty ? (
        <p class="text-sm text-gray-500 italic">{result.notes ?? 'No argument structure identified.'}</p>
      ) : view === 'diagram' ? (
        <ArgumentFlowChart result={result} />
      ) : view === 'inverted' ? (
        <InvertedView result={result} evidenceAssessments={evidenceAssessments} />
      ) : (
        <DetailedView result={result} terminologyPreference={terminologyPreference} evidenceAssessments={evidenceAssessments} />
      )}

      {/* Full-screen modal — portalled to <body> so it escapes the sticky
          sidebar's stacking context (otherwise the other panels paint over it). */}
      {expanded && typeof document !== 'undefined' && createPortal(
        <ExpandModal result={result} onClose={() => setExpanded(false)} />,
        document.body,
      )}
    </div>
  );
}
