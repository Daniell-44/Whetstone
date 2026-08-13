/**
 * The two rules the mini-briefing must not be able to lose.
 *
 * Both are deliberately implemented in code rather than left to the model, so
 * both are testable without a network call. The model supplies a comparison;
 * the decision to drop is made here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  applyRelevance,
  orderByDispute,
  verifyAgainstFetched,
  streamMiniBriefing,
  type MiniSource,
  type RelevanceVerdict,
  type MiniEvent,
} from '../../functions/_lib/premise/mini';
import { pageText, type FetchedPage } from '../../functions/_lib/premise/grounded';
import type { LlmProvider, ProxyRequest, ProxyResponse } from '../../functions/_lib/providers/types';

const src = (over: Partial<MiniSource> = {}): MiniSource => ({
  who: 'Someone', position: 'holds a view', quote: 'a quote of sufficient length to pass the gate',
  url: 'https://example.com/a', verified: true, ...over,
});

const verdict = (over: Partial<RelevanceVerdict> & { index: number }): RelevanceVerdict => ({
  claimSubject: 'capacity factor in per cent', quoteSubject: 'capacity factor in per cent',
  sameSubject: true, why: '', ...over,
});

describe('applyRelevance', () => {
  it('keeps a source whose subject matches the claim', () => {
    const out = applyRelevance([src()], [verdict({ index: 0 })]);
    expect(out[0].verified).toBe(true);
    expect(out[0].quote).toBeTruthy();
  });

  it('drops the real measured failure: megawatts against capacity factor', () => {
    // This exact pairing survived the quote gate on a live run. Both real, both
    // about nuclear, different quantities, and the pairing was worthless.
    const out = applyRelevance(
      [src({ quote: 'the reactor has a capacity of 1,100 megawatts and began operating in 2016' })],
      [verdict({
        index: 0,
        claimSubject: 'capacity factor, per cent of time running',
        quoteSubject: 'nameplate capacity in megawatts',
        sameSubject: false,
      })],
    );
    expect(out[0].verified).toBe(false);
    expect(out[0].quote).toBeUndefined();
    expect(out[0].relevanceNote).toContain('megawatts');
  });

  it('drops a source the judge said nothing about', () => {
    // Silence is not consent. A missing verdict is a failed check, not a pass,
    // because the alternative is showing the reader an unchecked quote.
    const out = applyRelevance([src(), src()], [verdict({ index: 0 })]);
    expect(out[0].verified).toBe(true);
    expect(out[1].verified).toBe(false);
    expect(out[1].relevanceNote).toBe('no relevance verdict returned');
  });

  it('keeps a source that disagrees with the claim', () => {
    // Disagreement is the point. It must never be confused with irrelevance.
    const out = applyRelevance(
      [src({ stance: 'contests' })],
      [verdict({ index: 0, sameSubject: true, why: 'same quantity, opposite figure' })],
    );
    expect(out[0].verified).toBe(true);
  });

  it('returns an empty list unchanged', () => {
    expect(applyRelevance([], [])).toEqual([]);
  });
});

describe('orderByDispute', () => {
  it('puts dispute first and agreement last', () => {
    const out = orderByDispute([
      src({ who: 'agrees', stance: 'supports' }),
      src({ who: 'qualifies', stance: 'complicates' }),
      src({ who: 'disputes', stance: 'contests' }),
    ]);
    expect(out.map((s) => s.who)).toEqual(['disputes', 'qualifies', 'agrees']);
  });

  it('is stable within a stance, so retrieval order breaks ties', () => {
    const out = orderByDispute([
      src({ who: 'first', stance: 'contests' }),
      src({ who: 'second', stance: 'contests' }),
    ]);
    expect(out.map((s) => s.who)).toEqual(['first', 'second']);
  });

  it('treats a missing stance as agreement, so it cannot jump the queue', () => {
    const out = orderByDispute([src({ who: 'unstated' }), src({ who: 'disputes', stance: 'contests' })]);
    expect(out[0].who).toBe('disputes');
  });
});

describe('verifyAgainstFetched', () => {
  const page: FetchedPage = {
    url: 'https://example.com/a', resolvedUrl: 'https://example.com/a',
    text: 'The report found that reactors of this class run about 60 per cent of the time in practice.',
  };

  it('keeps a quote that appears on the page', () => {
    const out = verifyAgainstFetched([src({ quote: 'run about 60 per cent of the time in practice' })], [page]);
    expect(out[0].verified).toBe(true);
  });

  it('drops a quote that does not', () => {
    const out = verifyAgainstFetched([src({ quote: 'run about 90 per cent of the time in practice' })], [page]);
    expect(out[0].verified).toBe(false);
    expect(out[0].quote).toBeUndefined();
  });

  it('drops a quote too short to be evidence', () => {
    const out = verifyAgainstFetched([src({ quote: 'reactors run' })], [page]);
    expect(out[0].verified).toBe(false);
    expect(out[0].verifyNote).toContain('too short');
  });
});

describe('pageText entity decoding', () => {
  it('decodes the entity that leaked into a live quotation', () => {
    // A run published `nuclear energy&rsquo;s` inside quotation marks, because
    // the quote is copied out of this text and shown to a reader unchanged.
    expect(pageText('<p>nuclear energy&rsquo;s capacity factor</p>')).toContain('nuclear energy’s');
  });

  it('decodes numeric and hex entities', () => {
    expect(pageText('90&#37; and 25&#x25;')).toBe('90% and 25%');
  });

  it('leaves a literal &amp;rsquo; alone', () => {
    // &amp; is decoded last on purpose. Decoding it first would turn a page
    // that literally writes out an entity into one that appears to use it.
    expect(pageText('<p>write &amp;rsquo; for an apostrophe</p>')).toContain('&rsquo;');
  });

  it('still strips scripts and styles', () => {
    expect(pageText('<script>var x = "hidden"</script><p>shown</p>')).not.toContain('hidden');
  });
});

/**
 * The staging contract. The outline must reach the reader before any research
 * starts, because the whole reason it exists is to give them something to read
 * during the wait.
 */
describe('streamMiniBriefing staging', () => {
  function scripted(byOperation: Record<string, unknown>): LlmProvider {
    return {
      name: 'scripted',
      async complete(req: ProxyRequest): Promise<ProxyResponse> {
        const payload = byOperation[req.operation] ?? {};
        return { content: JSON.stringify(payload), inputTokens: 1, outputTokens: 1 };
      },
    };
  }

  // The grounded call goes out over raw fetch rather than through the provider,
  // because grounding is a tool flag on the Gemini endpoint and not part of the
  // provider interface. So the fallback tier has to be stubbed here or the
  // suite dials Google. It returning nothing is also the case worth pinning:
  // the run must still finish and still hand back the outline.
  function noSearchResults() {
    vi.stubGlobal('fetch', async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] } }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
  }
  afterEach(() => vi.unstubAllGlobals());

  it('researches one claim from a selection and two from an article', async () => {
    // Cost follows what was actually asked for. A selection has already been
    // pointed at, so spending a second search on a claim the reader did not
    // pick is spending their money answering a question they did not ask.
    noSearchResults();
    const seen: number[] = [];
    const provider: LlmProvider = {
      name: 'counting',
      async complete(req: ProxyRequest): Promise<ProxyResponse> {
        const payload = req.operation === 'analyze'
          ? { question: 'q', conclusion: 'c', claims: [{ claim: 'one', load: 'x' }, { claim: 'two', load: 'y' }, { claim: 'three', load: 'z' }] }
          : {};
        return { content: JSON.stringify(payload), inputTokens: 1, outputTokens: 1 };
      },
    };
    for (const trigger of ['selection', 'article'] as const) {
      for await (const ev of streamMiniBriefing('text', { provider, apiKey: 'x', trigger })) {
        if (ev.type === 'researching') seen.push(ev.claims.length);
      }
    }
    expect(seen).toEqual([1, 2]);
  });

  it('yields the outline first, before anything is searched', async () => {
    noSearchResults();
    const provider = scripted({
      analyze: {
        question: 'Is nuclear cheaper?',
        conclusion: 'It concludes nuclear is cheaper.',
        claims: [{ claim: 'A nuclear grid costs 25 per cent less.', load: 'the cost case fails' }],
      },
    });
    const events: MiniEvent[] = [];
    for await (const ev of streamMiniBriefing('some article text', { provider, apiKey: 'x', maxPremises: 0 })) {
      events.push(ev);
    }
    expect(events[0].type).toBe('outline');
    const first = events[0];
    if (first.type !== 'outline') throw new Error('unreachable');
    expect(first.outline.conclusion).toBe('It concludes nuclear is cheaper.');
    expect(first.outline.claims).toHaveLength(1);
    // With no premises researched it still finishes rather than hanging.
    expect(events.at(-1)?.type).toBe('done');
  });

  it('still yields an outline when the model returns unparseable text', async () => {
    noSearchResults();
    const provider: LlmProvider = {
      name: 'broken',
      async complete(): Promise<ProxyResponse> {
        return { content: 'sorry, I cannot do that', inputTokens: 1, outputTokens: 1 };
      },
    };
    const events: MiniEvent[] = [];
    for await (const ev of streamMiniBriefing('text', { provider, apiKey: 'x', maxPremises: 0 })) {
      events.push(ev);
    }
    expect(events[0].type).toBe('outline');
    const last = events.at(-1);
    if (last?.type !== 'done') throw new Error('expected a done event');
    expect(last.briefing.tier).toBe('none');
  });
});
