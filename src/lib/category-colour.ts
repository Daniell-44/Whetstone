// Per-category "ink" palette — a muted, cohesive family (deliberately NOT the
// saturated rainbow D3 abolished). Used as a thin colour tick on text cards and
// a dot in the Browse rail, so the sidebar and the feed share one colour system.
// Daniel signed off on this palette 2026-07-09. Redline (#CE2B14) stays reserved
// for findings, so it is intentionally absent here.
export const CATEGORY_COLOUR: Record<string, string> = {
  technology:  '#3E5F78', // muted blue
  economics:   '#8A5238', // muted rust
  environment: '#4F6B4E', // muted green
  energy:      '#6B7A3E', // muted olive (kin to environment; distinct)
  science:     '#3F6A6C', // muted teal
  law:         '#6B5D48', // muted brown
  philosophy:  '#5C4F6B', // muted plum
  education:   '#7A6440', // muted ochre
};

// Fallback: muted graphite for an unmapped category (and for "All").
export const CATEGORY_COLOUR_FALLBACK = '#5F6167';

export function categoryColour(category?: string | null): string {
  if (!category) return CATEGORY_COLOUR_FALLBACK;
  return CATEGORY_COLOUR[category.toLowerCase()] ?? CATEGORY_COLOUR_FALLBACK;
}
