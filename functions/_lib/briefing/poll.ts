// Poll-bar pole ordering (2026-08-10).
//
// A ::public question's answers can be mapped onto the briefing's axis: `<`
// marks an answer that reads for the left pole, `>` for the right, no marker
// for neither. The rendered bar then says so on three channels at once: the
// segment's HUE, its POSITION on the bar, and the values line underneath.
//
// Only one of those three was ever real. Hue was set from `side`, but the
// segments were rendered in whatever order the markdown happened to list them,
// so position was an authoring convention with nothing enforcing it, and the
// values line named no side at all. A sided poll typed right-answer-first
// would have quietly fallen back to hue as the only channel — which is no
// channel at all for a colourblind reader, and this site's editor is one.
//
// These two helpers are the enforcement. They live here rather than inline in
// BriefingArticle.astro because the .astro components are never rendered by
// the unit suite, so an invariant declared there cannot be regression-tested.

/** One answer segment of a poll bar, as parsed from a `q |` row. */
export interface PollBar {
  label: string;
  value: number;
  side?: 'left' | 'right';
}

/** The two pole names a briefing's spectrum axis is authored with. */
export interface SpectrumAxis {
  left: string;
  right: string;
}

/**
 * Left-pole answers first, unsided in the middle, right-pole answers last.
 *
 * `Array.prototype.sort` is required to be stable, so answers sharing a rank
 * keep the order the author wrote them in. That matters: an entirely unsided
 * poll (most of them) must render exactly as authored, because the author's
 * ordering is carrying editorial meaning we have no business rearranging.
 */
export function sortBarsByPole<T extends PollBar>(bars: readonly T[]): T[] {
  const rank = (s?: 'left' | 'right') => (s === 'left' ? 0 : s === 'right' ? 2 : 1);
  return [...bars].sort((x, y) => rank(x.side) - rank(y.side));
}

/**
 * The pole an answer reads for, in the axis's own words, or '' when it reads
 * for neither. Used to append "(favours nuclear pathway cheaper)" to the
 * values line and to the bar's aria-label, which is the channel that survives
 * a greyscale screen.
 */
export function poleFor(side: 'left' | 'right' | undefined, axis: SpectrumAxis): string {
  if (side === 'left') return axis.left;
  if (side === 'right') return axis.right;
  return '';
}
