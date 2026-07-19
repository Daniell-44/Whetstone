import { GROUNDEDNESS_LABEL } from '../../../functions/_lib/grounded/types';
import type { GroundednessKind } from '../../../functions/_lib/grounded/types';

// ---------------------------------------------------------------------------
// GroundednessDefs - definition strip for the three groundedness labels
// (Logic / Judgment call / Factual). Every finding card carries one of these
// chips, but a first-time visitor never learns what they mean; this strip,
// rendered above the verdict bar until dismissed once, is the glossary.
// The parent owns the open state (persisted via reader-helpers) and re-opens
// it from the (?) affordance on the verdict bar.
// ---------------------------------------------------------------------------

// Chip classes mirror GroundednessChip's KIND_STYLE so the glossary rows look
// exactly like the chips they explain.
const DEFS: { kind: GroundednessKind; chip: string; text: string }[] = [
  { kind: 'structural',   chip: 'bg-logic-bg text-logic border-logic/30',          text: 'Checkable in your text. Read the quote and judge the finding yourself.' },
  { kind: 'interpretive', chip: 'bg-judgment-bg text-judgment border-judgment/30', text: 'Depends on a reading you might reject.' },
  { kind: 'empirical',    chip: 'bg-factual-bg text-factual border-factual/30',    text: 'Rests on external evidence about the world.' },
];

export default function GroundednessDefs({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  if (!open) return null;
  return (
    <div class="rounded-lg border border-hairline bg-paper px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <p class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">How to read the labels</p>
        <button
          type="button"
          onClick={onDismiss}
          class="shrink-0 -mt-1 -mr-2 px-2 py-1 rounded-md text-xs font-medium text-muted hover:text-accent-support transition-colors"
        >
          Got it
        </button>
      </div>
      <dl class="mt-2 space-y-1.5">
        {DEFS.map(d => (
          <div key={d.kind} class="flex items-baseline gap-2">
            <dt class={`inline-flex items-center px-2 py-0.5 rounded-[2px] border text-xs font-mono font-medium shrink-0 ${d.chip}`}>
              {GROUNDEDNESS_LABEL[d.kind]}
            </dt>
            <dd class="text-xs text-ink leading-relaxed">{d.text}</dd>
          </div>
        ))}
      </dl>
      <p class="mt-2 text-xs text-muted leading-relaxed">
        The tag tells you what kind of check a finding is, not how confident the engine feels.
      </p>
    </div>
  );
}
