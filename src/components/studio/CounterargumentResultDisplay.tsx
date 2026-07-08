import type { CounterargumentResult } from '../../lib/counterargument';
import type { TerminologyPreference } from '../../lib/labels';
import LabelWithTooltip from '../ui/LabelWithTooltip';

interface Props {
  result:               CounterargumentResult;
  terminologyPreference?: TerminologyPreference;
}

export default function CounterargumentResultDisplay({ result, terminologyPreference }: Props) {
  return (
    <div class="space-y-6 border-t border-hairline pt-8">

      <div class="bg-paper border border-hairline rounded-xl p-5">
        <p class="text-xs font-mono font-semibold text-muted uppercase tracking-widest mb-2">
          <LabelWithTooltip label="centralClaim" preference={terminologyPreference} />
        </p>
        <p class="text-ink-strong text-base leading-relaxed">{result.centralClaim}</p>
      </div>

      <section>
        <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
          <LabelWithTooltip label="counterarguments" preference={terminologyPreference} />
        </h3>
        <div class="space-y-4">
          {result.counterarguments.map((c, i) => (
            <div key={i} class="rounded-xl border border-hairline bg-paper p-5 space-y-4">

              <p class="text-sm font-semibold text-ink-strong leading-snug">{c.position}</p>

              <div class="space-y-2 pl-4 border-l-2 border-hairline">
                <div>
                  <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
                    <LabelWithTooltip label="toulminClaim" preference={terminologyPreference} />
                  </p>
                  <p class="text-sm text-ink leading-relaxed">{c.strongestCase.claim}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
                    <LabelWithTooltip label="toulminGrounds" preference={terminologyPreference} />
                  </p>
                  <p class="text-sm text-ink leading-relaxed">{c.strongestCase.grounds}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
                    <LabelWithTooltip label="toulminWarrant" preference={terminologyPreference} />
                  </p>
                  <p class="text-sm text-ink leading-relaxed">{c.strongestCase.warrant}</p>
                </div>
              </div>

              <div class="rounded-lg bg-surface border border-hairline p-3">
                <p class="text-xs font-mono font-semibold text-muted uppercase tracking-wide mb-1">
                  <LabelWithTooltip label="missedByDraft" preference={terminologyPreference} />
                </p>
                <p class="text-sm text-ink leading-relaxed">{c.missedByDraft}</p>
              </div>

              <p class="text-xs text-muted italic leading-relaxed">{c.why}</p>

            </div>
          ))}
        </div>
      </section>

      {result.notes && (
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Notes</h3>
          <p class="text-sm text-ink leading-relaxed">{result.notes}</p>
        </section>
      )}

    </div>
  );
}
