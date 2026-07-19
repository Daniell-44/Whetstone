import { SAMPLES } from '../../data/samples';
import GroundednessChip from '../grounded/GroundednessChip';

// The empty-state right rail on /audit (xl+ only). Before a first result the
// page's right half was dead space; this fills it with PROOF, not marketing:
// one real finding from the helmets sample (actual engine output, not
// hand-written specimen copy — it stays honest because it IS the audit the
// "Try this example" button loads), plus the groundedness vocabulary so the
// three chips are learnable before the first result arrives.
//
// Rendered inside AuditForm (not the page) because it must vanish the moment
// a result exists — that state lives in the island.

const SPECIMEN_SAMPLE = SAMPLES[0]; // helmets op-ed
const SPECIMEN = SPECIMEN_SAMPLE.cached.audit.namedFallacies[0]; // False Dichotomy, high

export default function SpecimenRail({ onTrySample }: { onTrySample?: () => void }) {
  return (
    <aside class="hidden xl:block" aria-label="What a finding looks like">
      <p class="font-mono text-[10px] uppercase tracking-[0.08em] text-muted mb-2">What a finding looks like</p>

      <div class="bg-surface border border-hairline">
        <div class="instrument-rule"></div>
        <div class="px-4 py-3.5">
          <p class="font-mono text-[10px] uppercase tracking-[0.08em] text-muted mb-1.5">
            Audit · {SPECIMEN_SAMPLE.shortLabel}
          </p>
          <div class="flex items-baseline justify-between gap-2 mb-2">
            <p class="font-serif text-lg text-ink-strong leading-snug">{SPECIMEN.name}</p>
            <span class="inline-flex items-center gap-1.5 shrink-0 font-mono text-[10px] uppercase tracking-wide text-accent">
              <span class="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span>
              Critical
            </span>
          </div>
          <blockquote class="border-l-2 border-accent/60 pl-3 mb-2.5">
            <p class="text-[13px] text-ink italic leading-snug">"{SPECIMEN.quote}"</p>
          </blockquote>
          <p class="text-[13px] text-ink leading-snug mb-2.5">{SPECIMEN.explanation}</p>
          <GroundednessChip groundedness={SPECIMEN.groundedness} compact />
        </div>
      </div>

      {onTrySample && (
        <button
          type="button"
          onClick={onTrySample}
          class="inline-flex items-center gap-1.5 mt-2.5 text-xs text-accent-support hover:text-accent transition-colors"
        >
          See this argument's full audit
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5-5 5M6 12h12"/></svg>
        </button>
      )}

      <div class="mt-5 pt-4 border-t border-hairline">
        <p class="text-[11px] text-muted mb-2">Each finding labelled by how you'd check it:</p>
        <div class="space-y-1.5 text-[12px] text-ink leading-snug">
          <p><span class="font-mono text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border bg-logic-bg text-logic border-logic/30 mr-1.5">Logic</span>checkable against your own text</p>
          <p><span class="font-mono text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border bg-judgment-bg text-judgment border-judgment/30 mr-1.5">Judgment call</span>depends on a reading you might reject</p>
          <p><span class="font-mono text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border bg-factual-bg text-factual border-factual/30 mr-1.5">Factual</span>rests on outside evidence</p>
        </div>
        <p class="text-[11px] text-muted mt-3">
          Every finding is anchored to a verbatim quote from the text. If the engine can't quote it, it isn't shown.
        </p>
      </div>
    </aside>
  );
}
