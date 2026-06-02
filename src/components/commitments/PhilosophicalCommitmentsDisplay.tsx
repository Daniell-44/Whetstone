import type {
  PhilosophicalCommitmentsResult,
  FrameworkDetection,
  AlternativePerspective,
} from '../../../functions/_lib/philosophical-commitments/types';
import LabelWithTooltip from '../ui/LabelWithTooltip';

// ---------------------------------------------------------------------------
// Framework pretty-printing
// ---------------------------------------------------------------------------

const FRAMEWORK_LABELS: Record<string, string> = {
  // Ethical
  consequentialist: 'Consequentialist',
  deontological:    'Deontological',
  virtue_ethics:    'Virtue Ethics',
  contractualist:   'Contractualist',
  utilitarian:      'Utilitarian',
  pluralist:        'Pluralist',
  unclear:          'Unclear',
  // Epistemic
  empiricist:       'Empiricist',
  rationalist:      'Rationalist',
  experiential:     'Experiential',
  authoritative:    'Authoritative',
  mixed:            'Mixed',
  // Political
  liberal:          'Liberal',
  libertarian:      'Libertarian',
  communitarian:    'Communitarian',
  conservative:     'Conservative',
  progressive:      'Progressive',
  socialist:        'Socialist',
  // Methodological
  reductionist:     'Reductionist',
  holist:           'Holist',
  individualist:    'Individualist',
  structuralist:    'Structuralist',
  universalist:     'Universalist',
  contextualist:    'Contextualist',
};

const FRAMEWORK_TYPE_LABELS: Record<string, string> = {
  ethical:          'Ethical',
  epistemic:        'Epistemic',
  political:        'Political',
  methodological:   'Methodological',
};

// ---------------------------------------------------------------------------
// Dimension card
// ---------------------------------------------------------------------------

type DimensionLabel =
  | 'commitmentsEthical'
  | 'commitmentsEpistemic'
  | 'commitmentsPolitical'
  | 'commitmentsMethodological';

function DimensionCard({
  label,
  detection,
}: {
  label: DimensionLabel;
  detection: FrameworkDetection<string> | null;
}) {
  return (
    <div class="rounded-lg border border-purple-100 bg-purple-50 p-4">
      <p class="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
        <LabelWithTooltip label={label} />
      </p>

      {detection === null ? (
        <p class="text-sm text-gray-400 italic">No clear framework signal</p>
      ) : (
        <div class="space-y-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-semibold text-gray-800">
              {FRAMEWORK_LABELS[detection.framework] ?? detection.framework}
            </span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              {detection.confidence}% confidence
            </span>
          </div>
          <p class="text-sm text-gray-700">{detection.explanation}</p>
          <p class="text-xs text-gray-500 italic border-l-2 border-purple-200 pl-2">
            {detection.evidence}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alternative perspective card
// ---------------------------------------------------------------------------

function AlternativeCard({ alt }: { alt: AlternativePerspective }) {
  return (
    <div class="rounded-lg border border-amber-100 bg-amber-50 p-4">
      <div class="flex items-center gap-2 flex-wrap mb-2">
        <span class="text-sm font-semibold text-gray-800">{alt.framework}</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
          {FRAMEWORK_TYPE_LABELS[alt.frameworkType] ?? alt.frameworkType}
        </span>
      </div>
      <p class="text-sm text-gray-700 mb-1.5">{alt.objection}</p>
      <p class="text-xs text-gray-500 italic">{alt.specificity}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  result: PhilosophicalCommitmentsResult;
}

export default function PhilosophicalCommitmentsDisplay({ result }: Props) {
  return (
    <div class="space-y-6">
      {/* Four dimension cards */}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DimensionCard label="commitmentsEthical"        detection={result.ethical} />
        <DimensionCard label="commitmentsEpistemic"      detection={result.epistemic} />
        <DimensionCard label="commitmentsPolitical"      detection={result.political} />
        <DimensionCard label="commitmentsMethodological" detection={result.methodological} />
      </div>

      {/* Alternative perspectives */}
      {result.alternativePerspectives.length > 0 && (
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            <LabelWithTooltip label="commitmentsAlternatives" />
          </p>
          <div class="space-y-2">
            {result.alternativePerspectives.map((alt, i) => (
              <AlternativeCard key={i} alt={alt} />
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {result.notes && (
        <p class="text-xs text-gray-500 italic border-t border-gray-100 pt-3">{result.notes}</p>
      )}
    </div>
  );
}
