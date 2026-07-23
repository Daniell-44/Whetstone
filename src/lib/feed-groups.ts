// Broad feed-filter groups (2026-07-17). The authored category vocabulary is
// nearly as wide as the corpus itself (~7 categories over ~8 briefings), so a
// per-category filter mostly produced single-card feeds. The home-page filter
// now advertises at most these three broad groups; card kickers keep showing
// the authored category, so the finer signal is preserved on the card.
import { categoryColour } from './category-colour';

export interface FeedGroup {
  id: string;
  label: string;
  // Rail/chip dot colour, anchored to a constituent category so the filter
  // and the card colour ticks stay in one colour system.
  colour: string;
}

// Authored category -> group id. A category not listed here stays ungrouped
// (visible under "All" only) until it is deliberately added.
const CATEGORY_TO_GROUP: Record<string, string> = {
  philosophy: 'society',
  education: 'society',
  law: 'society',
  politics: 'society',
  science: 'science-environment',
  environment: 'science-environment',
  energy: 'science-environment',
  health: 'science-environment',
  economics: 'economics-tech',
  technology: 'economics-tech',
  business: 'economics-tech',
};

export const FEED_GROUPS: FeedGroup[] = [
  { id: 'society', label: 'Society', colour: categoryColour('philosophy') },
  { id: 'science-environment', label: 'Science & environment', colour: categoryColour('science') },
  { id: 'economics-tech', label: 'Economics & tech', colour: categoryColour('economics') },
];

export function feedGroupFor(category?: string | null): string | null {
  if (!category) return null;
  return CATEGORY_TO_GROUP[category.toLowerCase().trim()] ?? null;
}

// Groups worth advertising: at least 2 briefings must map into a group for it
// to appear. Callers hide the whole filter UI when fewer than 2 groups qualify
// (a filter that can't split the feed is noise).
export function qualifyingFeedGroups(
  categories: Array<string | undefined | null>,
): Array<FeedGroup & { count: number }> {
  const counts = new Map<string, number>();
  for (const c of categories) {
    const g = feedGroupFor(c);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return FEED_GROUPS.map((g) => ({ ...g, count: counts.get(g.id) ?? 0 })).filter(
    (g) => g.count >= 2,
  );
}
