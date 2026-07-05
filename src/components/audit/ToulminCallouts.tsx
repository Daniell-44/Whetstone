import type { ToulminAnalysis } from '../../../functions/_lib/audit/types';
import type { TerminologyPreference } from '../../lib/labels';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import GroundednessChip from '../grounded/GroundednessChip';

// The Toulmin pieces that AREN'T already in the argument skeleton, folded in
// beneath it so the skeleton (derivation) and the Toulmin analysis read as ONE
// structure panel. The claim + grounds are the skeleton's conclusion + premises,
// so we only surface the *additive* parts: the load-bearing (unstated) assumptions
// — with their severity + groundedness — and the single weakest link.
//
// Note: the skeleton also marks implicit premises (★). Those are the structural
// steps; the assumptions below carry the *assessment* (how load-bearing / how
// shaky each one is). Kept as a complementary callout, not merged into the chain.

const SEV_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-muted',
};

export default function ToulminCallouts({ toulmin, terminologyPreference }: {
  toulmin:                ToulminAnalysis;
  terminologyPreference?: TerminologyPreference;
}) {
  const warrants = toulmin.unstatedWarrants ?? [];
  if (warrants.length === 0 && !toulmin.weakestLink) return null;

  return (
    <div class="space-y-3">
      {warrants.length > 0 && (
        <div class="rounded-lg border border-hairline bg-paper p-3">
          <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-2.5">
            Load-bearing assumptions
          </p>
          <ul class="space-y-2.5">
            {warrants.map((w, i) => (
              <li key={i} class="flex items-start gap-2">
                <span class={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${SEV_DOT[w.severity] ?? 'bg-muted'}`} aria-hidden="true" />
                <div class="min-w-0">
                  <p class="text-sm text-ink leading-snug">{w.warrant}</p>
                  {w.necessity && (
                    <p class="text-xs text-muted leading-snug mt-0.5">{w.necessity}</p>
                  )}
                  <span class="inline-block mt-1"><GroundednessChip groundedness={w.groundedness} compact /></span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {toulmin.weakestLink && (
        <div class="rounded-lg bg-paper border border-hairline border-l-2 border-l-accent p-3">
          <p class="text-xs font-semibold uppercase tracking-widest text-muted mb-1">
            <LabelWithTooltip label="weakestLink" preference={terminologyPreference} />
          </p>
          <p class="text-sm text-ink leading-relaxed">{toulmin.weakestLink}</p>
        </div>
      )}
    </div>
  );
}
