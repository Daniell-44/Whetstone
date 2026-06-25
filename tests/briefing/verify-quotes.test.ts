import { describe, it, expect } from 'vitest';
import { normalizeForMatch, quoteMatch, collectQuoteChecks } from '../../functions/_lib/briefing/verify-quotes';
import type { BriefingArticle } from '../../functions/_lib/briefing/types';

describe('normalizeForMatch', () => {
  it('unifies smart quotes, dashes, case, and whitespace', () => {
    expect(normalizeForMatch('“Don’t  — stop”')).toBe('"don\'t - stop"');
  });
});

describe('quoteMatch', () => {
  const body = 'The columnist wrote that labour is no exception to the law of demand, and the jobs would simply vanish.';

  it('matches verbatim after normalisation', () => {
    expect(quoteMatch('labour is no exception', body)).toBe('exact');
  });
  it('ignores case and smart-quote differences', () => {
    expect(quoteMatch('“Labour Is No Exception”', body)).toBe('exact');
  });
  it('falls back to fuzzy when an edge word differs', () => {
    expect(quoteMatch('zzz labour is no exception to the law of demand yyy', body)).toBe('fuzzy');
  });
  it('returns none for an absent quote', () => {
    expect(quoteMatch('the moon is made of cheese', body)).toBe('none');
  });
  it('returns none for an empty quote', () => {
    expect(quoteMatch('', body)).toBe('none');
  });
});

describe('collectQuoteChecks', () => {
  const briefing: BriefingArticle = {
    slug: 't',
    question: 'q',
    publishedDate: '2026-01-01',
    spectrumAxis: { left: 'l', right: 'r' },
    sources: [{ id: 'wsj', label: 'WSJ', url: 'https://wsj.example/x', leaning: -50, side: 'left', assessed: true }],
    blocks: [
      { type: 'position', colourIndex: 0, label: 'P1', sourceId: 'wsj', quote: 'no exception', paragraph: '...', audit: { name: 'X', kind: 'structural', explanation: '.' } },
      { type: 'position', colourIndex: 1, label: 'P2', sourceId: 'wsj', quote: '', paragraph: '...', audit: { name: 'Y', kind: 'structural', explanation: '.' } },
      { type: 'takes', items: [
        { source: 'Cato', url: 'https://cato.example/y', quote: 'cut jobs', audit: 'a' },
        { source: 'NoUrl', quote: 'x', audit: 'a' },
      ] },
    ],
  };

  it('pulls takes + positions-with-quote, resolves source urls, skips empties', () => {
    const checks = collectQuoteChecks(briefing);
    expect(checks).toHaveLength(2); // P1 + Cato take; P2 (no quote) and NoUrl take (no url) skipped
    expect(checks.find((c) => c.where.startsWith('position'))?.url).toBe('https://wsj.example/x');
    expect(checks.find((c) => c.where.startsWith('takes'))?.url).toBe('https://cato.example/y');
  });
});
