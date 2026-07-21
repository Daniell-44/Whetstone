import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEED_GROUPS, feedGroupFor, qualifyingFeedGroups } from '../../src/lib/feed-groups';

const BRIEFINGS_DIR = fileURLToPath(new URL('../../src/content/briefings', import.meta.url));

// Authored `category:` values pulled straight from the corpus front-matter, so
// the mapping is tested against what is actually published, not a fixture.
function corpusCategories(): string[] {
  return readdirSync(BRIEFINGS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const raw = readFileSync(join(BRIEFINGS_DIR, f), 'utf8');
      const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const line = fm?.[1].match(/^category:\s*(.+)\s*$/m);
      return line ? line[1].trim() : null;
    })
    .filter((c): c is string => c != null);
}

describe('feedGroupFor', () => {
  it('maps every authored corpus category into a group', () => {
    const cats = corpusCategories();
    expect(cats.length).toBeGreaterThan(0);
    for (const cat of cats) {
      expect(feedGroupFor(cat), `unmapped category "${cat}" — add it to CATEGORY_TO_GROUP`).not.toBeNull();
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(feedGroupFor('Philosophy')).toBe('society');
    expect(feedGroupFor(' economics ')).toBe('economics-tech');
  });

  it('returns null for unknown or missing categories', () => {
    expect(feedGroupFor('astrology')).toBeNull();
    expect(feedGroupFor(undefined)).toBeNull();
    expect(feedGroupFor(null)).toBeNull();
    expect(feedGroupFor('')).toBeNull();
  });
});

describe('qualifyingFeedGroups', () => {
  it('advertises at most 3 broad groups', () => {
    expect(FEED_GROUPS.length).toBeLessThanOrEqual(3);
  });

  it('only includes groups matching at least 2 briefings', () => {
    // society x2, science-environment x1 -> only society qualifies.
    const groups = qualifyingFeedGroups(['philosophy', 'law', 'science']);
    expect(groups.map((g) => g.id)).toEqual(['society']);
    expect(groups[0].count).toBe(2);
  });

  it('returns an empty list when nothing qualifies (callers hide the filter)', () => {
    expect(qualifyingFeedGroups([])).toEqual([]);
    expect(qualifyingFeedGroups(['philosophy', 'science', 'economics'])).toEqual([]);
    expect(qualifyingFeedGroups(['astrology', 'astrology', null, undefined])).toEqual([]);
  });

  it('preserves FEED_GROUPS order and counts unmapped categories nowhere', () => {
    const groups = qualifyingFeedGroups([
      'economics', 'technology', // economics-tech x2
      'philosophy', 'education', 'law', // society x3
      'astrology', // unmapped
    ]);
    expect(groups.map((g) => g.id)).toEqual(['society', 'economics-tech']);
    expect(groups.map((g) => g.count)).toEqual([3, 2]);
  });

  it('full corpus (archived included) maps into at least 2 qualifying groups', () => {
    // Guards the CATEGORY_TO_GROUP mapping against the whole authored corpus.
    // NOTE: since the 2026-07-21 clean-slate the feed filter reads LIVE
    // (non-archived) briefings only, so this does NOT assert the filter is
    // visible on the home page — with everything archived it correctly hides.
    const groups = qualifyingFeedGroups(corpusCategories());
    expect(groups.length).toBeGreaterThanOrEqual(2);
    for (const g of groups) expect(g.count).toBeGreaterThanOrEqual(2);
  });
});
