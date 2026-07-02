// ---------------------------------------------------------------------------
// Reader landing hero headline - A/B experiment surface.
//
// Renders the A/B-tested H1 of the Reader page. Astro SSRs the island's initial
// (control) render; it swaps to the concrete headline when the visitor is
// assigned that variant. (The subheadline was removed 2026-07 — the input +
// example chips carry the guidance now.)
// ---------------------------------------------------------------------------

import { useVariant } from '../../lib/ab/useVariant';

const COPY = {
  control:  { headline: 'Think more carefully about arguments.' },
  concrete: { headline: "See where an argument's reasoning breaks down." },
} as const;

export default function HeroHeadline() {
  const variant  = useVariant('reader_hero_copy');
  const resolved = variant === 'concrete' ? 'concrete' : 'control';
  const copy     = COPY[resolved];

  return (
    <h1 class="font-serif text-2xl sm:text-4xl text-ink-strong leading-tight text-center text-balance max-w-4xl mx-auto">
      {copy.headline}
    </h1>
  );
}
