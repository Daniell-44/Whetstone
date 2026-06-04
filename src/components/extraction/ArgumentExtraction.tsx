import { useState } from 'preact/hooks';
import type { ArgumentExtractionResult, ExtractionStatement } from '../../lib/extraction';
import type { TerminologyPreference } from '../../lib/labels';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import ArgumentFlowChart from './ArgumentFlowChart';

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
// Statement card
// ---------------------------------------------------------------------------

function StatementCard({ stmt }: { stmt: ExtractionStatement }) {
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
// Main component
// ---------------------------------------------------------------------------

interface Props {
  result:                 ArgumentExtractionResult;
  terminologyPreference?: TerminologyPreference;
}

export default function ArgumentExtraction({ result, terminologyPreference }: Props) {
  const [view, setView] = useState<'text' | 'diagram'>('text');
  const premises    = result.statements.filter(s => s.type === 'premise');
  const conclusions = result.statements.filter(s => s.type === 'conclusion');
  const isEmpty     = result.statements.length === 0;

  return (
    <div class="space-y-6">
      {/* Central claim + view toggle */}
      <div>
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-gray-700 mb-1">
              <LabelWithTooltip label="extraction" preference={terminologyPreference} />
            </p>
            <p class="text-base text-gray-900 font-medium">{result.centralClaim}</p>
            <span class="inline-block mt-1 text-xs text-gray-400">{result.confidence}% confidence</span>
          </div>
          {!isEmpty && (
            <div class="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setView('text')}
                class={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  view === 'text'
                    ? 'bg-gray-200 text-gray-700'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setView('diagram')}
                class={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  view === 'diagram'
                    ? 'bg-gray-200 text-gray-700'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                Diagram
              </button>
            </div>
          )}
        </div>
      </div>

      {isEmpty ? (
        <p class="text-sm text-gray-500 italic">{result.notes ?? 'No argument structure identified.'}</p>
      ) : view === 'diagram' ? (
        /* Flow chart view */
        <ArgumentFlowChart result={result} />
      ) : (
        /* Text view (original) */
        <>
          {/* Premises */}
          {premises.length > 0 && (
            <div>
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <LabelWithTooltip label="extractionPremise" preference={terminologyPreference} />
              </p>
              <div class="space-y-2">
                {premises.map(stmt => (
                  <StatementCard key={stmt.id} stmt={stmt} />
                ))}
              </div>
            </div>
          )}

          {/* Conclusions */}
          {conclusions.length > 0 && (
            <div>
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                <LabelWithTooltip label="extractionConclusion" preference={terminologyPreference} />
              </p>
              <div class="space-y-2">
                {conclusions.map(stmt => (
                  <StatementCard key={stmt.id} stmt={stmt} />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {result.notes && (
            <p class="text-xs text-gray-500 italic border-t border-gray-100 pt-3">{result.notes}</p>
          )}
        </>
      )}
    </div>
  );
}
