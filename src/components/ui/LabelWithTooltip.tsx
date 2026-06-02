import { getLabels, getTooltips } from '../../lib/labels';
import type { TerminologyPreference } from '../../lib/labels';

interface Props {
  label:       keyof ReturnType<typeof getLabels>;
  preference?: TerminologyPreference;
}

// Renders the friendly label text followed by a native <details> tooltip.
// The <details> expands inline when the user clicks "(?)", showing two sentences:
// one plain-English explanation, one with the philosophical/historical pedigree.
// No JavaScript state — pure HTML disclosure element. Reset styles are applied
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
        <summary class="cursor-pointer list-none ml-1 text-gray-400 hover:text-gray-600 text-[0.65rem] not-italic">
          (?)
        </summary>
        <div class="mt-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 max-w-xs not-italic font-normal normal-case tracking-normal">
          <p class="text-gray-700 leading-relaxed">{tooltip.plain}</p>
          <p class="text-gray-400 leading-relaxed mt-1 italic">{tooltip.pedigree}</p>
        </div>
      </details>
    </>
  );
}
