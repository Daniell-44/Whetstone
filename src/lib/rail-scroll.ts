// ---------------------------------------------------------------------------
// Rail tracking: how far a side rail's content has advanced.
//
// The Reader's result has one pinned reading column and side rails whose
// content is taller than the screen. Two ways to move a rail:
//
//   - give it its own scrollbar (position: sticky + max-height + overflow-y).
//     The page scroll then does nothing to it and the pointer has to be inside
//     the rail. That is what the current layout does.
//   - let the PAGE scroll advance it, which is what Daniel asked for
//     ("when scrolling down the page findings and structure can go up").
//
// There is no CSS for the second. The CSSWG issue asking sticky to scroll when
// taller than the viewport (w3c/csswg-drafts#7092) was closed without one, and
// the CSS-only answer everyone reaches for IS the first option. So it needs a
// scroll listener, and this is the arithmetic that listener runs.
//
// Kept pure and out of the component so it can be tested without a browser:
// the DOM half (listener, rAF, transform) is untestable here, but a wrong
// number is the failure that would actually be noticed.
// ---------------------------------------------------------------------------

/** How far through its travel the frame is: 0 at the top, 1 at the end. */
export function railProgress(frameTop: number, frameHeight: number, viewportHeight: number): number {
  // The frame is deliberately taller than the viewport; the surplus is the
  // scroll budget. A frame that fits has no budget and never advances.
  const travel = frameHeight - viewportHeight;
  if (travel <= 0) return 0;
  return clamp01(-frameTop / travel);
}

/**
 * Pixels to shift one rail's content upward.
 *
 * Each rail divides its own overflow by the same progress value, so a short
 * rail and a long rail start together and finish together. That is the point:
 * one gesture moves both, and neither runs out while the other is still going.
 */
export function railShift(progress: number, contentHeight: number, windowHeight: number): number {
  const room = Math.max(0, contentHeight - windowHeight);
  return Math.round(room * clamp01(progress));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
