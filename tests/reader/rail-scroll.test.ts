/**
 * The arithmetic behind rails that advance on page scroll.
 *
 * The DOM half of this (listener, rAF, transform) cannot be exercised on the
 * machine it was written on, because the browser pane there does not scroll.
 * The arithmetic can be, and a wrong number is the failure a reader would
 * actually notice: a rail that finishes early and then sits dead, or one that
 * never reaches its last card.
 */
import { describe, it, expect } from 'vitest';
import { railProgress, railShift } from '../../src/lib/rail-scroll';

const VIEWPORT = 900;

describe('railProgress', () => {
  it('is 0 while the frame top is still at or below the viewport top', () => {
    expect(railProgress(0, 1980, VIEWPORT)).toBe(0);
    expect(railProgress(120, 1980, VIEWPORT)).toBe(0);
  });

  it('reaches 1 exactly when the frame bottom meets the viewport bottom', () => {
    // travel = 1980 - 900 = 1080, so frameTop of -1080 is the end.
    expect(railProgress(-1080, 1980, VIEWPORT)).toBe(1);
  });

  it('is linear in between', () => {
    expect(railProgress(-540, 1980, VIEWPORT)).toBeCloseTo(0.5, 5);
    expect(railProgress(-270, 1980, VIEWPORT)).toBeCloseTo(0.25, 5);
  });

  it('never leaves 0..1, however far past the end the page scrolls', () => {
    expect(railProgress(-99999, 1980, VIEWPORT)).toBe(1);
    expect(railProgress(99999, 1980, VIEWPORT)).toBe(0);
  });

  it('stays at 0 when the frame fits the viewport, so there is nothing to advance', () => {
    // A short result on a tall screen: no surplus height, no scroll budget.
    expect(railProgress(-50, 600, VIEWPORT)).toBe(0);
    expect(railProgress(-50, VIEWPORT, VIEWPORT)).toBe(0);
  });

  it('does not produce NaN from a zero or nonsense viewport', () => {
    expect(railProgress(-100, 0, 0)).toBe(0);
    expect(railProgress(Number.NaN, 1980, VIEWPORT)).toBe(0);
  });
});

describe('railShift', () => {
  it('shifts nothing at the top and the whole overflow at the end', () => {
    expect(railShift(0, 1560, 740)).toBe(0);
    expect(railShift(1, 1560, 740)).toBe(820);
  });

  it('lands the last pixel of content exactly at the window bottom', () => {
    // The end state has to show the final card in full. Content 1560 in a 740
    // window shifted 820 puts the content bottom on the window bottom.
    const content = 1560, win = 740;
    expect(railShift(1, content, win) + win).toBe(content);
  });

  it('never shifts content that already fits', () => {
    expect(railShift(1, 400, 740)).toBe(0);
    expect(railShift(0.5, 740, 740)).toBe(0);
  });

  it('moves two rails of different heights in step, both finishing together', () => {
    // This is the whole reason the progress value is shared rather than each
    // rail scrolling itself: a short rail must not run out while a long one is
    // still going.
    const shortRail = { content: 900, win: 740 };
    const longRail  = { content: 2600, win: 740 };
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const a = railShift(t, shortRail.content, shortRail.win);
      const b = railShift(t, longRail.content, longRail.win);
      expect(a / Math.max(1, shortRail.content - shortRail.win)).toBeCloseTo(t, 2);
      expect(b / Math.max(1, longRail.content - longRail.win)).toBeCloseTo(t, 2);
    }
    expect(railShift(1, shortRail.content, shortRail.win)).toBe(160);
    expect(railShift(1, longRail.content, longRail.win)).toBe(1860);
  });

  it('clamps a progress value that arrives out of range', () => {
    expect(railShift(-3, 1560, 740)).toBe(0);
    expect(railShift(4, 1560, 740)).toBe(820);
  });
});
