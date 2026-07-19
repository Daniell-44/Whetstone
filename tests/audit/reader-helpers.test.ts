import { describe, it, expect } from 'vitest';
import {
  truncateForShare,
  SHARE_DRAFT_MAX_CHARS,
  findingsSheetButtonLabel,
  hasSeenGroundednessDefs,
  markGroundednessDefsSeen,
} from '../../src/components/audit/reader-helpers';

describe('truncateForShare', () => {
  it('returns short text unchanged', () => {
    expect(truncateForShare('hello')).toBe('hello');
  });

  it('caps at the audit-link body limit (10,000 chars)', () => {
    const long = 'a'.repeat(SHARE_DRAFT_MAX_CHARS + 500);
    expect(truncateForShare(long)).toHaveLength(SHARE_DRAFT_MAX_CHARS);
  });

  it('leaves text exactly at the limit alone', () => {
    const exact = 'b'.repeat(SHARE_DRAFT_MAX_CHARS);
    expect(truncateForShare(exact)).toBe(exact);
  });

  it('honours a custom max', () => {
    expect(truncateForShare('abcdef', 3)).toBe('abc');
  });
});

describe('findingsSheetButtonLabel', () => {
  it('drops the count at zero (the sheet still has structure + empty state)', () => {
    expect(findingsSheetButtonLabel(0)).toBe('See the findings');
  });

  it('singular at one', () => {
    expect(findingsSheetButtonLabel(1)).toBe('See the 1 finding');
  });

  it('plural above one', () => {
    expect(findingsSheetButtonLabel(7)).toBe('See the 7 findings');
  });
});

describe('groundedness-seen storage helpers (no localStorage in Node)', () => {
  it('hasSeenGroundednessDefs treats missing storage as unseen', () => {
    expect(hasSeenGroundednessDefs()).toBe(false);
  });

  it('markGroundednessDefsSeen does not throw without storage', () => {
    expect(() => markGroundednessDefsSeen()).not.toThrow();
  });
});
