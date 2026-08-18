/**
 * The copy button's output, tested where the quotation marks are decided.
 *
 * A briefing pasted into a document outlives the page it came from, so the
 * export carries the same promise the page does: quotation marks mean a
 * passage that was checked character-for-character against its source. A
 * source whose quote failed the gate still has a `position`, which is OUR
 * paraphrase, and putting that in quotation marks would be the cardinal sin
 * committed by a formatting helper.
 */
import { describe, it, expect } from 'vitest';
import { briefingToMarkdown } from '../../src/components/premise/markdown';
import type { ClientMiniBriefing } from '../../functions/_lib/premise/mini';

function briefing(over: Partial<ClientMiniBriefing> = {}): ClientMiniBriefing {
  return {
    tier: 'premises',
    question: 'Is nuclear cheaper than renewables for Australia?',
    conclusion: 'It turns on how often reactors would actually run.',
    premises: [],
    opposing: [],
    limits: [],
    dropped: { unverified: 0, offClaim: 0 },
    attempts: [],
    cost: { calls: 3, groundedCalls: 1, inputTokens: 10, outputTokens: 10, ms: 100 },
    timing: { outlineMs: 10, totalMs: 100 },
    ...over,
  };
}

describe('briefingToMarkdown', () => {
  it('puts quotation marks around a verified quote and names who said it', () => {
    const md = briefingToMarkdown(briefing({
      premises: [{
        claim: 'Reactors would run about 90 per cent of the time.',
        load: 'the cost case fails without it',
        undisputed: false,
        sources: [{
          who: 'Grattan Institute', position: 'calls the figure optimistic',
          quote: 'assuming 90 per cent for a fleet of seven plants looks overly optimistic',
          url: 'https://example.com/grattan', verified: true, stance: 'contests',
        }],
      }],
    }));
    expect(md).toContain('"assuming 90 per cent for a fleet of seven plants looks overly optimistic"');
    expect(md).toContain('Contests. Grattan Institute');
    expect(md).toContain('https://example.com/grattan');
  });

  it('never puts quotation marks around our own paraphrase', () => {
    // The cardinal rule, enforced at the last place text is formatted before
    // it leaves the site.
    const md = briefingToMarkdown(briefing({
      premises: [{
        claim: 'Reactors would run about 90 per cent of the time.',
        load: 'the cost case fails without it',
        undisputed: false,
        sources: [{
          who: 'CSIRO', position: 'prices a range far below it',
          url: 'https://example.com/gencost', verified: false, stance: 'complicates',
        }],
      }],
    }));
    expect(md).toContain('prices a range far below it');
    expect(md).not.toContain('"prices a range far below it"');
  });

  it('carries the verification promise and the limits into the export', () => {
    // A briefing read in someone else's document has none of the page's
    // framing, so the export has to say what it is on its own.
    const md = briefingToMarkdown(briefing({
      limits: ['One further claim was named but not researched in this run.'],
    }));
    expect(md).toContain('checked word-for-word against its source page');
    expect(md).toContain('One further claim was named but not researched in this run.');
    expect(md).toContain('What this cannot promise');
  });

  it('says plainly when a claim drew no objection, rather than leaving silence', () => {
    const md = briefingToMarkdown(briefing({
      premises: [{
        claim: 'Australia has no operating power reactors.',
        load: 'the comparison assumes a starting point',
        undisputed: true,
        sources: [],
      }],
    }));
    expect(md).toContain('No published objection was found');
    expect(md).toContain('That is not agreement');
  });

  it('writes no em dashes, per house style', () => {
    const md = briefingToMarkdown(briefing({
      limits: ['Only one opposing piece could be verified.'],
      premises: [{
        claim: 'A claim.', load: 'a load.', undisputed: false,
        sources: [{ who: 'Someone', position: 'holds a view', quote: 'a verified passage of sufficient length', url: 'https://example.com/a', verified: true, stance: 'contests' }],
      }],
    }));
    expect(md).not.toContain('—');
  });
});
