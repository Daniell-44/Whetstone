import { describe, it, expect, vi } from 'vitest';
import {
  normalizeCacheUrl,
  handlePlacementRequest,
  buildCatalog,
  CACHE_HIT_TTL_S,
  CACHE_NULL_TTL_S,
  type PlacementCacheKV,
  type PlacementHandlerDeps,
  type ModelPlacement,
} from '../../src/lib/extension-api/placement';
import type { BriefingArticle } from '../../functions/_lib/briefing/types';

// --- Fixtures ---------------------------------------------------------------

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
      id: 'a',
      label: 'The comparison writes the plant off too early',
      publication: 'Example Institute',
      url: 'https://example.com/a',
      stance: -2,
      confidence: 'high',
    },
    {
      id: 'b',
      label: "Ted O'Brien",
      publication: 'Example Radio',
      url: 'https://example.com/b',
      stance: 2,
      confidence: 'med',
    },
  ],
} as unknown as BriefingArticle;

const catalog = buildCatalog([nuclearish]);

const ARTICLE =
  'The numbers in the official comparison are not serious. A reactor is a sixty-year machine and the model writes it off in thirty. On any honest asset life, nuclear power ends up the cheaper pathway for Australia.';

const goodModel: ModelPlacement = {
  matchedSlug: 'nuclear-costings-parent',
  stance: -2,
  camp: null,
  respondsTo: null,
  confidence: 'high',
  basisQuote: 'On any honest asset life, nuclear power ends up the cheaper pathway for Australia.',
};

function makeKv(): PlacementCacheKV & { store: Map<string, string>; ttls: number[] } {
  const store = new Map<string, string>();
  const ttls: number[] = [];
  return {
    store,
    ttls,
    get: async (k) => store.get(k) ?? null,
    put: async (k, v, opts) => {
      store.set(k, v);
      if (opts?.expirationTtl) ttls.push(opts.expirationTtl);
    },
  };
}

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

// --- Tests ------------------------------------------------------------------

describe('normalizeCacheUrl', () => {
  it('strips hashes and tracking params, lowercases the host', () => {
    expect(
      normalizeCacheUrl('https://Example.com/story?utm_source=x&fbclid=y&page=2#frag'),
    ).toBe('https://example.com/story?page=2');
  });

  it('rejects non-http schemes', () => {
    expect(normalizeCacheUrl('chrome-extension://abc/page.html')).toBeNull();
    expect(normalizeCacheUrl('not a url')).toBeNull();
  });
});

describe('the tier-2 placement cache', () => {
  it('cacheOnly misses answer uncached with zero model spend', async () => {
    const runModel = vi.fn(async () => goodModel);
    const res = await handlePlacementRequest(
      makeRequest({ url: 'https://example.com/story', cacheOnly: true }),
      { ...baseDeps, cacheKv: makeKv(), runModel },
    );
    const data = (await res.json()) as { ok: boolean; placement: unknown; uncached?: boolean };
    expect(data).toMatchObject({ ok: true, placement: null, uncached: true });
    expect(runModel).not.toHaveBeenCalled();
  });

  it('a text request with a URL fills the cache; the next reader hits it without the model', async () => {
    const kv = makeKv();
    const runModel = vi.fn(async () => goodModel);
    const deps = { ...baseDeps, cacheKv: kv, runModel };
    const url = 'https://example.com/oped?utm_campaign=x';

    const first = await handlePlacementRequest(makeRequest({ text: ARTICLE, url }), deps);
    const firstData = (await first.json()) as { placement: { tier: string } };
    expect(firstData.placement.tier).toBe('briefing');
    expect(runModel).toHaveBeenCalledTimes(1);
    expect(kv.ttls).toEqual([CACHE_HIT_TTL_S]);

    // Same page, tracking params differ — still a hit, still one model call.
    const second = await handlePlacementRequest(
      makeRequest({ text: ARTICLE, url: 'https://example.com/oped?utm_source=y' }),
      deps,
    );
    const secondData = (await second.json()) as { placement: { tier: string } };
    expect(secondData.placement.tier).toBe('cache');
    expect(runModel).toHaveBeenCalledTimes(1);

    // And the hover path answers from it too.
    const hover = await handlePlacementRequest(
      makeRequest({ url, cacheOnly: true }),
      deps,
    );
    const hoverData = (await hover.json()) as { placement: { tier: string; briefingSlug: string } };
    expect(hoverData.placement).toMatchObject({ tier: 'cache', briefingSlug: 'nuclear-costings-parent' });
  });

  it('null placements cache on the shorter TTL so unmapped pages do not re-bill', async () => {
    const kv = makeKv();
    const runModel = vi.fn(async () => ({
      matchedSlug: null,
      stance: null,
      camp: null,
      respondsTo: null,
      confidence: null,
      basisQuote: null,
    }));
    const deps = { ...baseDeps, cacheKv: kv, runModel };
    const url = 'https://example.com/unrelated';

    await handlePlacementRequest(makeRequest({ text: ARTICLE, url }), deps);
    expect(kv.ttls).toEqual([CACHE_NULL_TTL_S]);

    const again = await handlePlacementRequest(makeRequest({ text: ARTICLE, url }), deps);
    const data = (await again.json()) as { ok: boolean; placement: unknown };
    expect(data).toMatchObject({ ok: true, placement: null });
    expect(runModel).toHaveBeenCalledTimes(1);
  });

  it('a broken cache entry is a miss, never an error', async () => {
    const kv = makeKv();
    const deps = { ...baseDeps, cacheKv: kv, runModel: vi.fn(async () => goodModel) };
    const url = 'https://example.com/broken';
    // Poison whatever key the URL maps to.
    await handlePlacementRequest(makeRequest({ text: ARTICLE, url }), deps);
    for (const k of kv.store.keys()) kv.store.set(k, '{not json');
    const res = await handlePlacementRequest(makeRequest({ url, cacheOnly: true }), deps);
    const data = (await res.json()) as { ok: boolean; uncached?: boolean };
    expect(data).toMatchObject({ ok: true, uncached: true });
  });

  it('without a cacheKv, behaviour is unchanged and cacheOnly answers uncached', async () => {
    const res = await handlePlacementRequest(
      makeRequest({ url: 'https://example.com/x', cacheOnly: true }),
      { ...baseDeps },
    );
    const data = (await res.json()) as { ok: boolean; uncached?: boolean };
    expect(data).toMatchObject({ ok: true, placement: null, uncached: true });
  });
});

describe('suggestion titles compose short name-labels with the publication', () => {
  it('a bare personal name gains its outlet', async () => {
    const kv = makeKv();
    const res = await handlePlacementRequest(
      makeRequest({ text: ARTICLE, url: 'https://example.com/titles' }),
      { ...baseDeps, cacheKv: kv, runModel: async () => goodModel },
    );
    const data = (await res.json()) as { suggestions: { kind: string; title: string }[] };
    const opposing = data.suggestions.find((s) => s.kind === 'opposing');
    expect(opposing?.title).toBe("Ted O'Brien · Example Radio");
  });
});
