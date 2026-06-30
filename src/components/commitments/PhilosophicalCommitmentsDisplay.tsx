import type {
  PhilosophicalCommitmentsResult,
  FrameworkDetection,
  AlternativePerspective,
} from '../../../functions/_lib/philosophical-commitments/types';
import type { TerminologyPreference } from '../../lib/labels';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import GroundednessChip from '../grounded/GroundednessChip';

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
  preference,
}: {
  label:      DimensionLabel;
  detection:  FrameworkDetection<string> | null;
  preference?: TerminologyPreference;
}) {
  return (
    <div class="rounded-lg border border-purple-100 bg-purple-50 p-4">
      <p class="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
        <LabelWithTooltip label={label} preference={preference} />
      </p>

      {detection === null ? (
        <p class="text-sm text-muted italic">No clear framework signal</p>
      ) : (
        <div class="space-y-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-semibold text-ink">
              {FRAMEWORK_LABELS[detection.framework] ?? detection.framework}
            </span>
            <GroundednessChip groundedness={detection.groundedness} compact />
          </div>
          <p class="text-sm text-ink">{detection.explanation}</p>
          <p class="text-xs text-muted italic border-l-2 border-purple-200 pl-2">
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
        <span class="text-sm font-semibold text-ink">{alt.framework}</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
          {FRAMEWORK_TYPE_LABELS[alt.frameworkType] ?? alt.frameworkType}
        </span>
      </div>
      <p class="text-sm text-ink mb-1.5">{alt.objection}</p>
      <p class="text-xs text-muted italic">{alt.specificity}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  result:                 PhilosophicalCommitmentsResult;
  terminologyPreference?: TerminologyPreference;
}

export default function PhilosophicalCommitmentsDisplay({ result, terminologyPreference }: Props) {
  return (
    <div class="space-y-6">
      {/* Four dimension cards */}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DimensionCard label="commitmentsEthical"        detection={result.ethical} preference={terminologyPreference} />
        <DimensionCard label="commitmentsEpistemic"      detection={result.epistemic} preference={terminologyPreference} />
        <DimensionCard label="commitmentsPolitical"      detection={result.political} preference={terminologyPreference} />
        <DimensionCard label="commitmentsMethodological" detection={result.methodological} preference={terminologyPreference} />
      </div>

      {/* Alternative perspectives */}
      {result.alternativePerspectives.length > 0 && (
        <div>
          <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            <LabelWithTooltip label="commitmentsAlternatives" preference={terminologyPreference} />
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
        <p class="text-xs text-muted italic border-t border-hairline pt-3">{result.notes}</p>
      )}
    </div>
  );
}
