import { getLabels, getTooltips } from '../../lib/labels';
import type { TerminologyPreference } from '../../lib/labels';

interface Props {
  label:       keyof ReturnType<typeof getLabels>;
  preference?: TerminologyPreference;
}

// Renders the friendly label text followed by a native <details> tooltip.
// The <details> expands inline when the user clicks "(?)", showing two sentences:
// one plain-English explanation, one with the philosophical/historical pedigree.
// No JavaScript state - pure HTML disclosure element. Reset styles are applied
// so the tooltip doesn't inherit uppercase/tracking from parent headings.
export default function LabelWithTooltip({ label, preference }: Props) {
  const labels   = getLabels(preference);
  const tooltips = getTooltips(preference);
  const text     = labels[label];
  const tooltip  = tooltips[label];

  if (!tooltip) return <>{text}</>;

  return (
    <>
      {text}
      <details class="inline font-normal normal-case tracking-normal">
        {/* Inline vertical padding paints outside the line box (no layout shift)
           while growing the tap target to ~30x26px — the (?) was ~18x14px,
           under the WCAG 2.5.8 24px minimum and hard to hit on a phone. */}
        <summary class="cursor-pointer list-none inline px-1.5 py-2 ml-0.5 text-muted hover:text-ink text-[0.65rem] not-italic">
          (?)
        </summary>
        <div class="mt-1.5 text-xs bg-paper border border-hairline rounded-lg px-3 py-2.5 max-w-xs not-italic font-normal normal-case tracking-normal">
          <p class="text-ink leading-relaxed">{tooltip.plain}</p>
          <p class="text-muted leading-relaxed mt-1 italic">{tooltip.pedigree}</p>
        </div>
      </details>
    </>
  );
}
