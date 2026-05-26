import { describe, it, expect } from 'vitest';
import {
  deriveSlug,
  isPositionCountValid,
  arePositionsReadyForGeneration,
} from '../../src/lib/curatorHelpers';

// ---------------------------------------------------------------------------
// deriveSlug
// ---------------------------------------------------------------------------

describe('deriveSlug', () => {
  it('lowercases and hyphenates words', () => {
    expect(deriveSlug('Should schools ban smartphones')).toBe(
      'should-schools-ban-smartphones',
    );
  });

  it('strips question marks and other punctuation', () => {
    expect(deriveSlug('Should schools ban smartphones?')).toBe(
      'should-schools-ban-smartphones',
    );
  });

  it('strips slashes and adjacent non-alphanumeric chars', () => {
    expect(deriveSlug('What about AI/ML?')).toBe('what-about-aiml');
  });

  it('collapses multiple whitespace into a single hyphen', () => {
    expect(deriveSlug('Too   Many   Spaces')).toBe('too-many-spaces');
  });

  it('trims leading and trailing whitespace', () => {
    expect(deriveSlug('  hello world  ')).toBe('hello-world');
  });

  it('collapses consecutive hyphens left over from punctuation', () => {
    expect(deriveSlug('A -- B')).toBe('a-b');
  });

  it('returns empty string for empty input', () => {
    expect(deriveSlug('')).toBe('');
  });

  it('produces the real smartphone-ban slug correctly', () => {
    expect(deriveSlug('Should schools ban smartphones during the school day?')).toBe(
      'should-schools-ban-smartphones-during-the-school-day',
    );
  });
});

// ---------------------------------------------------------------------------
// isPositionCountValid
// ---------------------------------------------------------------------------

describe('isPositionCountValid', () => {
  it('accepts 2 (minimum)', () => expect(isPositionCountValid(2)).toBe(true));
  it('accepts 3',           () => expect(isPositionCountValid(3)).toBe(true));
  it('accepts 5 (maximum)', () => expect(isPositionCountValid(5)).toBe(true));
  it('rejects 0',           () => expect(isPositionCountValid(0)).toBe(false));
  it('rejects 1',           () => expect(isPositionCountValid(1)).toBe(false));
  it('rejects 6',           () => expect(isPositionCountValid(6)).toBe(false));
});

// ---------------------------------------------------------------------------
// arePositionsReadyForGeneration
// ---------------------------------------------------------------------------

describe('arePositionsReadyForGeneration', () => {
  const pos = (label: string, texts: string[]) => ({
    label,
    articles: texts.map(text => ({ text })),
  });

  it('returns true for 2 valid positions', () => {
    expect(
      arePositionsReadyForGeneration([
        pos('Yes', ['Some article text']),
        pos('No', ['Other article text']),
      ]),
    ).toBe(true);
  });

  it('returns true when a position has multiple articles and only one has text', () => {
    expect(
      arePositionsReadyForGeneration([
        pos('Yes', ['', 'Non-empty text']),
        pos('No', ['Other text']),
      ]),
    ).toBe(true);
  });

  it('returns false when a position label is empty', () => {
    expect(
      arePositionsReadyForGeneration([
        pos('', ['Some article text']),
        pos('No', ['text']),
      ]),
    ).toBe(false);
  });

  it('returns false when all articles for a position have empty text', () => {
    expect(
      arePositionsReadyForGeneration([
        pos('Yes', ['', '   ']),
        pos('No', ['text']),
      ]),
    ).toBe(false);
  });

  it('returns false for fewer than 2 positions', () => {
    expect(arePositionsReadyForGeneration([pos('Yes', ['text'])])).toBe(false);
  });

  it('returns false for more than 5 positions', () => {
    const positions = Array.from({ length: 6 }, (_, i) =>
      pos(`Position ${i}`, ['text']),
    );
    expect(arePositionsReadyForGeneration(positions)).toBe(false);
  });

  it('returns false when label is only whitespace', () => {
    expect(
      arePositionsReadyForGeneration([
        pos('   ', ['Some text']),
        pos('No', ['text']),
      ]),
    ).toBe(false);
  });
});
