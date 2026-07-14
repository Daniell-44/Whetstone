// ---------------------------------------------------------------------------
// DeeperLensPanel - on-demand lens runner.
//
// Used on both the Reader (free) and Studio (free + Pro). Renders four
// lens buttons; each fires its endpoint on click and renders the result
// inline below. The structural-incentive lens is visually separated and
// always-on-caveat per its design.
//
// Auth model:
//   - Endpoints require sign-in (401 if not signed in)
//   - We render the "Sign in to use" upsell when 401 is received
//   - All lens endpoints are now free-tier (no SUBSCRIPTION_REQUIRED)
// ---------------------------------------------------------------------------

import { useState, useCallback } from 'preact/hooks';
import { getDeeperLensLabels, type TerminologyPreference } from '../../lib/labels';
import type { PresuppositionResult } from '../../../functions/_lib/presupposition/types';
import type { RhetoricalModeResult } from '../../../functions/_lib/rhetorical-mode/types';
import type { EpistemicHumilityResult } from '../../../functions/_lib/epistemic-humility/types';
import type { DisagreementEngagementResult } from '../../../functions/_lib/disagreement-engagement/types';
import type { StructuralIncentiveResult } from '../../../functions/_lib/structural-incentive/types';
import PresuppositionDisplay from '../presupposition/PresuppositionDisplay';
import RhetoricalModeDisplay from '../rhetorical-mode/RhetoricalModeDisplay';
import EpistemicHumilityDisplay from '../epistemic-humility/EpistemicHumilityDisplay';
import DisagreementEngagementDisplay from '../disagreement-engagement/DisagreementEngagementDisplay';
import StructuralIncentiveDisplay from '../structural-incentive/StructuralIncentiveDisplay';
import { runLens as runLensShared, type SectionState, type LensName } from '../tool/engine';

interface Props {
  /** Text to analyse with each lens. */
  text:    string;
  /** Surface label for analytics (e.g. "reader", "studio"). */
  surface: string;
  /** Terminology preference for lens labels (defaults to plain). */
  preference?: TerminologyPreference;
  /** Whether the viewer has Pro. The deeper lenses are Pro-only; non-Pro sees a teaser. */
  isPro?: boolean;
}

type LensStatus = 'idle' | 'loading' | 'done' | 'error';
function combineStatus(...ss: LensStatus[]): LensStatus {
  if (ss.some(s => s === 'loading')) return 'loading';
  if (ss.every(s => s === 'done'))   return 'done';
  if (ss.some(s => s === 'error'))   return 'error';
  return 'idle';
}

function LensButton({
  label,
  status,
  onClick,
}: {
  label:   string;
  status:  'idle' | 'loading' | 'done' | 'error';
  onClick: () => void;
}) {
  const isLoading = status === 'loading';
  const isDone    = status === 'done';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading || isDone}
      class={`text-xs font-medium px-3 py-2 rounded-lg border transition-colors text-center flex items-center justify-center min-h-[40px]
        ${isDone     ? 'bg-emerald-50 border-emerald-200 text-emerald-700 cursor-default' :
          isLoading  ? 'bg-accent/5  border-accent/30  text-accent  cursor-wait'    :
                       'bg-surface      border-hairline    text-ink    hover:bg-accent/5 hover:border-accent/30 hover:text-accent'}`}
    >
      {isLoading ? `${label}…` : isDone ? `✓ ${label}` : label}
    </button>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div class="rounded-lg bg-accent/5 border border-accent/20 p-4 text-center">
      <p class="text-sm text-accent font-medium">{label}</p>
    </div>
  );
}

function SectionError({ code, message }: { code: string; message: string }) {
  if (code === 'UNAUTHORIZED') {
    return (
      <div class="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
        <p class="text-sm text-amber-800 font-medium mb-1">Sign in to use this lens</p>
        <p class="text-xs text-amber-700 mb-3">Free with a Whetstone account.</p>
        <a href="/login?returnTo=/reader" class="inline-block text-xs text-amber-700 font-semibold underline hover:text-amber-900">
          Sign in →
        </a>
      </div>
    );
  }
  return (
    <div class="rounded-lg bg-red-50 border border-red-200 p-3">
      <p class="text-xs text-red-700">{message}</p>
    </div>
  );
}

export default function DeeperLensPanel({ text, surface, preference, isPro = false }: Props) {
  const lensLabels = getDeeperLensLabels(preference);
  const [presupState,  setPresupState]   = useState<SectionState<PresuppositionResult>>({ status: 'idle' });
  const [rhetState,    setRhetState]     = useState<SectionState<RhetoricalModeResult>>({ status: 'idle' });
  const [humilityState, setHumilityState] = useState<SectionState<EpistemicHumilityResult>>({ status: 'idle' });
  const [disagreeState, setDisagreeState] = useState<SectionState<DisagreementEngagementResult>>({ status: 'idle' });
  const [siState,       setSiState]       = useState<SectionState<StructuralIncentiveResult>>({ status: 'idle' });

  const runLens = useCallback(async (
    lens:   LensName,
    setter: (s: SectionState<any>) => void,
  ) => {
    await runLensShared({ lens, text, surface, setter });
  }, [text, surface]);

  return (
    <div class="rounded-lg border border-hairline bg-surface p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-semibold uppercase tracking-widest text-muted">Deeper read</h3>
        <span class="text-xs text-muted font-medium">Free with sign-in</span>
      </div>

      {/* The lens endpoints gate on session only (free with a Whetstone
         account), not on Pro — so the buttons show to everyone and an
         anonymous click surfaces the "Sign in to use this lens (free)"
         SectionError, rather than mislabelling the lenses as Studio Pro. */}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <LensButton
          label="How it's framed"
          status={combineStatus(presupState.status, rhetState.status)}
          onClick={() => { void runLens('presupposition', setPresupState); void runLens('rhetorical-mode', setRhetState); }}
        />
        <LensButton
          label="How honestly it argues"
          status={combineStatus(humilityState.status, disagreeState.status)}
          onClick={() => { void runLens('epistemic-humility', setHumilityState); void runLens('disagreement-engagement', setDisagreeState); }}
        />
        <LensButton
          label="Whose interests it serves"
          status={siState.status}
          onClick={() => void runLens('structural-incentive', setSiState)}
        />
      </div>

      {presupState.status === 'loading' && <SectionLoading label="Surfacing presuppositions…" />}
      {presupState.status === 'error' && <SectionError code={presupState.code} message={presupState.message} />}
      {presupState.status === 'done' && (
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-widest text-accent mb-2">{lensLabels.presupposition}</h4>
          <PresuppositionDisplay result={presupState.data} />
        </div>
      )}

      {rhetState.status === 'loading' && <SectionLoading label="Analysing rhetorical balance…" />}
      {rhetState.status === 'error' && <SectionError code={rhetState.code} message={rhetState.message} />}
      {rhetState.status === 'done' && (
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-widest text-accent mb-2">{lensLabels.rhetoricalMode}</h4>
          <RhetoricalModeDisplay result={rhetState.data} />
        </div>
      )}

      {humilityState.status === 'loading' && <SectionLoading label="Checking certainty calibration…" />}
      {humilityState.status === 'error' && <SectionError code={humilityState.code} message={humilityState.message} />}
      {humilityState.status === 'done' && (
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-widest text-accent mb-2">{lensLabels.epistemicHumility}</h4>
          <EpistemicHumilityDisplay result={humilityState.data} />
        </div>
      )}

      {disagreeState.status === 'loading' && <SectionLoading label="Evaluating engagement with opposing positions…" />}
      {disagreeState.status === 'error' && <SectionError code={disagreeState.code} message={disagreeState.message} />}
      {disagreeState.status === 'done' && (
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-widest text-accent mb-2">{lensLabels.disagreementEngagement}</h4>
          <DisagreementEngagementDisplay result={disagreeState.data} />
        </div>
      )}

      {siState.status === 'loading' && <SectionLoading label="Mapping structural interest alignment…" />}
      {siState.status === 'error' && <SectionError code={siState.code} message={siState.message} />}
      {siState.status === 'done' && (
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-2">{lensLabels.structuralIncentive}</h4>
          <StructuralIncentiveDisplay result={siState.data} />
        </div>
      )}
    </div>
  );
}
