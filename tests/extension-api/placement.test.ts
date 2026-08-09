import { describe, it, expect } from 'vitest';
import {
  buildCatalog,
  quoteIsVerbatim,
  resolvePlacement,
  buildSuggestions,
  handlePlacementRequest,
  type CatalogBriefing,
  type ModelPlacement,
  type PlacementHandlerDeps,
} from '../../src/lib/extension-api/placement';
import type { BriefingArticle } from '../../functions/_lib/briefing/types';

// --- Catalog fixtures ------------------------------------------------------

const nuclearish = {
  slug: 'nuclear-costings-parent',
  kind: 'briefing',
  question: 'Why nobody actually knows if nuclear is cheaper',
  publishedDate: '2026-08-01',
  spectrumAxis: { left: 'nuclear pathway cheaper', right: 'renewables pathway cheaper' },
  sources: [],
  blocks: [],
  positionSources: [
    {
      id: 'cis',
      label: 'The official comparison writes the plant off too early',
      publication: 'Example Institute',
      url: 'https://example.com/cis',
      stance: -2,
      confidence: 'high',
      camp: 'Fighting inside the models',
    },
    {
      id: 'grattan',
      label: 'Every defensible fix still leaves nuclear behind',
      publication: 'Example Grattan',
      url: 'https://example.com/grattan',
      stance: 1,
      confidence: 'high',
      camp: 'Fighting inside the models',
    },
    {
      id: 'mountain',
      label: 'The whole comparison asks the wrong question',
      url: 'https://example.com/mountain',
      stance: 2,
      confidence: 'med',
      camp: 'Refusing the frame',
    },
  ],
} as unknown as BriefingArticle;

const essayish = {
  slug: 'some-essay',
  kind: 'opinion',
  question: 'An essay',
  publishedDate: '2026-08-02',
  spectrumAxis: { left: '', right: '' },
  sources: [],
  blocks: [],
} as unknown as BriefingArticle;

const ARTICLE = [
  'The numbers in the official comparison are not serious.',
  'A reactor is a sixty-year machine and the model writes it off in thirty.',
  'On any honest asset life, nuclear power ends up the cheaper pathway for Australia.',
].join(' ');

const catalog = buildCatalog([nuclearish, essayish]);

// --- Tests -----------------------------------------------------------------

describe('buildCatalog', () => {
  it('keeps briefing-kind, axis-bearing articles only', () => {
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.slug).toBe('nuclear-costings-parent');
  });

  it('dedupes camps in authored order and carries positions', () => {
    expect(catalog[0]?.camps).toEqual(['Fighting inside the models', 'Refusing the frame']);
    expect(catalog[0]?.positions).toHaveLength(3);
  });
});

describe('quoteIsVerbatim — the cardinal-sin gate', () => {
  it('accepts an exact sentence', () => {
    expect(
      quoteIsVerbatim(
        'A reactor is a sixty-year machine and the model writes it off in thirty.',
        ARTICLE,
      ),
    ).toBe(true);
  });

  it('tolerates whitespace and curly-quote differences only', () => {
    expect(quoteIsVerbatim('sixty-year machine   and the model', ARTICLE)).toBe(true);
    expect(
      quoteIsVerbatim('the model ‘writes’ it off in thirty', "the model 'writes' it off in thirty"),
    ).toBe(true);
  });

  it('rejects paraphrase', () => {
    expect(quoteIsVerbatim('reactors last sixty years but are modelled at thirty', ARTICLE)).toBe(
      false,
    );
  });
});

const goodModel: ModelPlacement = {
  matchedSlug: 'nuclear-costings-parent',
  stance: -2,
  camp: 'Fighting inside the models',
  respondsTo: 'The official comparison',
  confidence: 'high',
  basisQuote: 'On any honest asset life, nuclear power ends up the cheaper pathway for Australia.',
};

describe('resolvePlacement', () => {
  it('resolves a clean match into a schema-valid placement', () => {
    const r = resolvePlacement(goodModel, catalog, ARTICLE);
    expect(r?.placement).toMatchObject({
      tier: 'briefing',
      briefingSlug: 'nuclear-costings-parent',
      stance: -2,
      camp: 'Fighting inside the models',
      axisLeft: 'nuclear pathway cheaper',
    });
  });

  it('rejects the whole placement when the basis quote is not verbatim', () => {
    expect(
      resolvePlacement({ ...goodModel, basisQuote: 'nuclear is clearly cheaper overall' }, catalog, ARTICLE),
    ).toBeNull();
  });

  it('rejects unknown slugs and null stances', () => {
    expect(resolvePlacement({ ...goodModel, matchedSlug: 'nope' }, catalog, ARTICLE)).toBeNull();
    expect(resolvePlacement({ ...goodModel, stance: null }, catalog, ARTICLE)).toBeNull();
  });

  it('drops a camp the briefing never authored', () => {
    const r = resolvePlacement({ ...goodModel, camp: 'Invented camp' }, catalog, ARTICLE);
    expect(r?.placement.camp).toBeUndefined();
  });
});

describe('buildSuggestions', () => {
  const briefing = catalog[0] as CatalogBriefing;

  it('leads with the briefing, then the strongest opposing position', () => {
    const s = buildSuggestions(briefing, -2, 'https://thewhetstone.review');
    expect(s[0]).toMatchObject({ kind: 'briefing', source: 'The Whetstone' });
    expect(s[1]).toMatchObject({ kind: 'opposing', stance: 2, url: 'https://example.com/mountain' });
  });

  it('a centre stance gets the strongest voice as adjacent, not "opposing"', () => {
    const s = buildSuggestions(briefing, 0);
    expect(s[1]).toMatchObject({ kind: 'adjacent' });
  });

  it('falls back to a missing publication honestly', () => {
    const s = buildSuggestions(briefing, -2);
    expect(s[1]?.source).toBe('audited on The Whetstone');
  });
});

// --- Handler ---------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request('https://thewhetstone.review/api/extension/placement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const baseDeps: PlacementHandlerDeps = {
  rateLimitKv: undefined,
  geminiApiKey: 'test-key',
  provider: { complete: async () => ({ content: '{}', inputTokens: 0, outputTokens: 0 }) } as never,
  catalog,
  dailyCap: 10,
};

describe('handlePlacementRequest', () => {
  it('returns the placement and suggestions on a match', async () => {
    const res = await handlePlacementRequest(makeRequest({ text: ARTICLE }), {
      ...baseDeps,
      runModel: async () => goodModel,
    });
    const data = (await res.json()) as { ok: boolean; placement: unknown; suggestions: unknown[] };
    expect(data.ok).toBe(true);
    expect(data.placement).toMatchObject({ briefingSlug: 'nuclear-costings-parent' });
    expect(data.suggestions).toHaveLength(2);
  });

  it('returns the honest null on no match', async () => {
    const res = await handlePlacementRequest(makeRequest({ text: ARTICLE }), {
      ...baseDeps,
      runModel: async () => ({
        matchedSlug: null,
        stance: null,
        camp: null,
        respondsTo: null,
        confidence: null,
        basisQuote: null,
      }),
    });
    const data = (await res.json()) as { ok: boolean; placement: unknown };
    expect(data).toMatchObject({ ok: true, placement: null });
  });

  it('separates infra failure from no-map: model errors are ok:false', async () => {
    const res = await handlePlacementRequest(makeRequest({ text: ARTICLE }), {
      ...baseDeps,
      runModel: async () => {
        throw new Error('provider down');
      },
    });
    const data = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(data.ok).toBe(false);
    expect(data.error?.code).toBe('PLACEMENT_FAILED');
  });

  it('rejects short bodies', async () => {
    const res = await handlePlacementRequest(makeRequest({ text: 'too short' }), baseDeps);
    expect(res.status).toBe(400);
  });

  it('an empty catalog is the honest null, not an error', async () => {
    const res = await handlePlacementRequest(makeRequest({ text: ARTICLE }), {
      ...baseDeps,
      catalog: [],
    });
    const data = (await res.json()) as { ok: boolean; placement: unknown };
    expect(data).toMatchObject({ ok: true, placement: null });
  });

  it('honours the daily quota', async () => {
    const denyKv = {
      get: async () =>
        JSON.stringify({ count: 999, period: new Date().toISOString().slice(0, 10) }),
      put: async () => undefined,
    } as unknown as PlacementHandlerDeps['rateLimitKv'];
    const res = await handlePlacementRequest(makeRequest({ text: ARTICLE }), {
      ...baseDeps,
      rateLimitKv: denyKv,
      runModel: async () => goodModel,
    });
    const data = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(data.ok).toBe(false);
    expect(data.error?.code).toBe('RATE_LIMITED');
  });
});
