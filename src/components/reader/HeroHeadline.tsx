// ---------------------------------------------------------------------------
// Reader landing hero headline - A/B experiment surface.
//
// Renders the H1 + subheadline of the Reader page. The static control copy
// is also rendered SSR-side in reader.astro so first-paint is correct for
// the ~50% of users who get control. This island only mutates the DOM when
// the user is assigned the concrete variant.
// ---------------------------------------------------------------------------

import { useVariant } from '../../lib/ab/useVariant';

const COPY = {
  control: {
    headline: 'Think more carefully about arguments.',
    sub:      'Paste any text, drop a URL, or browse the briefings below.',
  },
  concrete: {
    headline: "See where an argument's reasoning breaks down.",
    sub:      'Paste any text, drop a URL, or browse a briefing to see the engine at work.',
  },
} as const;

export default function HeroHeadline() {
  const variant  = useVariant('reader_hero_copy');
  const resolved = variant === 'concrete' ? 'concrete' : 'control';
  const copy     = COPY[resolved];

  return (
    <>
      <h1 class="font-serif text-2xl sm:text-4xl text-ink-strong leading-tight text-center text-balance mb-4 max-w-4xl mx-auto">
        {copy.headline}
      </h1>
      <p class="text-base sm:text-lg text-muted leading-relaxed text-center max-w-2xl mx-auto">
        {copy.sub}
      </p>
    </>
  );
}
