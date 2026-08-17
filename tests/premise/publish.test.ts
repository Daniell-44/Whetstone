/**
 * What may be published under the masthead, and at what address.
 *
 * The floor is in code and tested here because publishing is the one action in
 * this pipeline that cannot be undone by pressing a button: a page that went
 * out can be taken down, but it was public while it was up. Everything below
 * is a rule about not putting unearned credibility on the front door.
 */
import { describe, it, expect } from 'vitest';
import { countVerifiedQuotes, publishability, questionSlug } from '../../functions/_lib/premise/publish';
import type { ClientMiniBriefing, MiniPremise, MiniSource } from '../../functions/_lib/premise/mini';

const source = (over: Partial<MiniSource> = {}): MiniSource => ({
  who: 'Grattan Institute', position: 'calls the figure optimistic',
  quote: 'assuming 90 per cent for a fleet of seven plants looks overly optimistic',
  url: 'https://example.com/a', verified: true, stance: 'contests', ...over,
});

const premise = (over: Partial<MiniPremise> = {}): MiniPremise => ({
  claim: 'Reactors would run about 90 per cent of the time.',
  load: 'the cost case fails without it',
  sources: [source()],
  undisputed: false,
  ...over,
});

const briefing = (over: Partial<ClientMiniBriefing> = {}): ClientMiniBriefing => ({
  tier: 'premises',
  question: 'Is nuclear cheaper than renewables for Australia?',
  conclusion: 'It turns on how often reactors would actually run.',
  premises: [premise()],
  opposing: [],
  limits: [],
  dropped: { unverified: 0, offClaim: 0 },
  attempts: [],
  cost: { calls: 3, groundedCalls: 1, inputTokens: 1, outputTokens: 1, ms: 1 },
  timing: { outlineMs: 1, totalMs: 1 },
  ...over,
});

describe('publishability', () => {
  it('clears a run that carries a verified quote', () => {
    const v = publishability(briefing());
    expect(v.ok).toBe(true);
    expect(v.verifiedQuotes).toBe(1);
  });

  it('refuses a run where no quote survived the gates', () => {
    // The engine saying "I could not check this" is honest in the log and
    // worthless on the home page. A briefing with nothing verified would be
    // borrowing the credibility of the pages beside it.
    const v = publishability(briefing({
      premises: [premise({ sources: [source({ verified: false, quote: undefined })] })],
    }));
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('no quote survived');
    expect(v.verifiedQuotes).toBe(0);
  });

  it('refuses a source marked verified that has no quote left on it', () => {
    // Both flags have to agree. A source whose quote was nulled by a gate is
    // not evidence, whatever its verified flag says.
    const v = publishability(briefing({
      premises: [premise({ sources: [source({ verified: true, quote: undefined })] })],
    }));
    expect(v.ok).toBe(false);
    expect(v.verifiedQuotes).toBe(0);
  });

  it('refuses the tier that verified nothing at all', () => {
    expect(publishability(briefing({ tier: 'none', premises: [], opposing: [] })).ok).toBe(false);
  });

  it('refuses a run with no question to put at the top of the page', () => {
    expect(publishability(briefing({ question: '  ' })).ok).toBe(false);
  });

  it('counts a verified quote on the fallback tier too', () => {
    // A contrast-tier run has no premises but can still carry checked quotes,
    // and there is nothing dishonest about publishing that as what it is.
    const v = publishability(briefing({ tier: 'contrast', premises: [], opposing: [source()] }));
    expect(v.ok).toBe(true);
    expect(v.verifiedQuotes).toBe(1);
  });
});

describe('countVerifiedQuotes', () => {
  // The number a feed card leads with. It was briefly recomputed on the card
  // itself from a payload the feed query does not fetch, so every card in the
  // feed said "0 verified quotes" while the page behind it showed one. Caught
  // in the browser, not by a test, which is why there is a test now.
  it('counts across premises and the fallback tier together', () => {
    expect(countVerifiedQuotes({
      premises: [premise({ sources: [source(), source({ who: 'Second' })] })],
      opposing: [source({ who: 'Third' })],
    })).toBe(3);
  });

  it('counts nothing when the gates left nothing behind', () => {
    expect(countVerifiedQuotes({
      premises: [premise({ sources: [source({ verified: false, quote: undefined })] })],
      opposing: [],
    })).toBe(0);
  });
});

describe('questionSlug', () => {
  it('makes a readable address out of the question', () => {
    expect(questionSlug('Is nuclear cheaper than renewables for Australia?', 'abc123xyz789'))
      .toBe('is-nuclear-cheaper-than-renewables-for-australia-abc123');
  });

  it('gives two identical questions two different addresses', () => {
    // The expected case, not the edge case. A collision that overwrote the
    // earlier page would lose a record the archive exists to keep.
    const q = 'Is nuclear cheaper than renewables for Australia?';
    expect(questionSlug(q, 'aaaaaa1111')).not.toBe(questionSlug(q, 'bbbbbb2222'));
  });

  it('drops apostrophes rather than turning them into hyphens', () => {
    expect(questionSlug("Is Australia's grid cheaper?", 'abc123')).toBe('is-australias-grid-cheaper-abc123');
  });

  it('trims a long question at a word boundary rather than mid-word', () => {
    const question = 'Is a nuclear inclusive electricity grid genuinely cheaper for Australian households over the coming decades?';
    const slug = questionSlug(question, 'abc123');
    expect(slug.endsWith('-abc123')).toBe(true);
    expect(slug.length).toBeLessThanOrEqual(68);
    // Every surviving segment is a whole word from the question, so a
    // truncated address still reads as English rather than ending mid-word.
    const words = new Set(question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' '));
    for (const seg of slug.replace(/-abc123$/, '').split('-')) {
      expect(words.has(seg)).toBe(true);
    }
  });

  it('still produces an address when the question has nothing sluggable in it', () => {
    expect(questionSlug('???', 'abc123')).toBe('question-abc123');
  });
});
