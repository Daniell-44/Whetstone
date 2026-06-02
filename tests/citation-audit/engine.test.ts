import { describe, it, expect, vi } from 'vitest';
import type { LlmProvider, ProxyRequest } from '../../functions/_lib/providers/types';
import type { ExtractResult } from '../../functions/_lib/extract/article';
import { auditCitations } from '../../functions/_lib/citation-audit/engine';
import { CITATION_FETCH_PARALLELISM } from '../../functions/_lib/citation-audit/constants';

// ---------------------------------------------------------------------------
// Fake provider
// ---------------------------------------------------------------------------

// Stage 1: extracts the given claims. Stage 2: returns supplied verdicts in order.
function makeFakeProvider(
  stage1Claims: Array<{ claim: string; evidenceQuote: string; citationUrl: string | null }>,
  verdicts: Array<{ verdict: string; verdictExplanation: string; sourceExcerpt: string | null; confidence: number }>,
): LlmProvider {
  let verdictIdx = 0;
  return {
    name: 'fake',
    complete: vi.fn(async (req: ProxyRequest) => {
      if (req.operation === 'triage') {
        // Stage 1 — claim extraction
        return {
          content:      JSON.stringify({ claims: stage1Claims }),
          inputTokens:  10,
          outputTokens: 20,
        };
      }
      // Stage 2 — verdict
      const v = verdicts[verdictIdx++] ?? {
        verdict: 'weakly_cited', verdictExplanation: 'fallback', sourceExcerpt: null, confidence: 60,
      };
      return {
        content:      JSON.stringify(v),
        inputTokens:  5,
        outputTokens: 10,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Fake extractor
// ---------------------------------------------------------------------------

function okExtractor(text = 'Source content goes here.'): (url: string) => Promise<ExtractResult> {
  return async (_url) => ({
    ok:      true,
    article: { title: 'Test Source', publication: 'Test Pub', url: _url, text },
  });
}

function failExtractor(): (url: string) => Promise<ExtractResult> {
  return async () => ({ ok: false, error: { code: 'FETCH_FAILED', message: 'not reachable' } });
}

const INSTANT_BACKOFF = [0, 0] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auditCitations — end-to-end pipeline', () => {
  it('returns expected shape with a mix of cited and uncited claims', async () => {
    const claims = [
      { claim: 'Stat A is 42%', evidenceQuote: 'Stat A is 42%', citationUrl: 'https://example.org/a' },
      { claim: 'B happened in 2018', evidenceQuote: 'B happened in 2018', citationUrl: null },
    ];
    const verdicts = [
      { verdict: 'well_cited', verdictExplanation: 'Source says 42%.', sourceExcerpt: '42%', confidence: 92 },
    ];
    const provider  = makeFakeProvider(claims, verdicts);
    const extractor = okExtractor();

    const { result, inputTokens, outputTokens, citationsFetched, citationsFailed } = await auditCitations(
      'Some draft text',
      { provider, apiKey: 'test-key', extractor, backoffDelaysMs: INSTANT_BACKOFF },
    );

    expect(result.factualClaims).toHaveLength(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.wellCited).toBe(1);
    expect(result.summary.uncited).toBe(1);
    expect(citationsFetched).toBe(1);
    expect(citationsFailed).toBe(0);
    expect(inputTokens).toBeGreaterThan(0);
    expect(outputTokens).toBeGreaterThan(0);
  });

  it('marks claims with unfetchable sources as unfetchable without calling Stage 2', async () => {
    const claims = [
      { claim: 'X is true', evidenceQuote: 'X is true', citationUrl: 'https://example.org/x' },
    ];
    const provider  = makeFakeProvider(claims, []);
    const extractor = failExtractor();

    const { result, citationsFetched, citationsFailed } = await auditCitations(
      'Some text',
      { provider, apiKey: 'key', extractor, backoffDelaysMs: INSTANT_BACKOFF },
    );

    expect(result.factualClaims[0]?.verdict).toBe('unfetchable');
    expect(result.summary.unfetchable).toBe(1);
    expect(citationsFetched).toBe(0);
    expect(citationsFailed).toBe(1);

    // Stage 2 should NOT have been called (only Stage 1)
    const calls = (provider.complete as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1); // only Stage 1
  });

  it('marks claims with no citationUrl as uncited without calling Stage 2', async () => {
    const claims = [
      { claim: 'Claim with no source', evidenceQuote: 'Claim with no source', citationUrl: null },
    ];
    const provider  = makeFakeProvider(claims, []);
    const extractor = okExtractor();

    const { result } = await auditCitations(
      'Some text',
      { provider, apiKey: 'key', extractor, backoffDelaysMs: INSTANT_BACKOFF },
    );

    expect(result.factualClaims[0]?.verdict).toBe('uncited');
    // Only Stage 1 call — no extractor call, no Stage 2
    const calls = (provider.complete as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
  });

  it('deduplicates URLs before fetching — same URL appears in multiple claims', async () => {
    const url = 'https://example.org/shared';
    const claims = [
      { claim: 'Claim A', evidenceQuote: 'A', citationUrl: url },
      { claim: 'Claim B', evidenceQuote: 'B', citationUrl: url },
    ];
    const verdicts = [
      { verdict: 'well_cited',   verdictExplanation: 'A ok', sourceExcerpt: null, confidence: 90 },
      { verdict: 'weakly_cited', verdictExplanation: 'B ok', sourceExcerpt: null, confidence: 70 },
    ];
    const fetchSpy = vi.fn(okExtractor());
    const provider = makeFakeProvider(claims, verdicts);

    const { result } = await auditCitations(
      'text',
      { provider, apiKey: 'key', extractor: fetchSpy, backoffDelaysMs: INSTANT_BACKOFF },
    );

    // URL should only be fetched ONCE even though two claims cite it
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.summary.total).toBe(2);
  });

  it('respects CITATION_FETCH_PARALLELISM — fetches at most N URLs concurrently per batch', async () => {
    const n       = CITATION_FETCH_PARALLELISM + 2; // more URLs than one batch
    const claims  = Array.from({ length: n }, (_, i) => ({
      claim:         `Claim ${i}`,
      evidenceQuote: `Quote ${i}`,
      citationUrl:   `https://example.org/${i}`,
    }));
    const verdicts = Array.from({ length: n }, () => ({
      verdict: 'unfetchable', verdictExplanation: 'x', sourceExcerpt: null, confidence: 100,
    }));

    let maxConcurrent = 0;
    let current       = 0;
    const trackingExtractor = async (_url: string): Promise<ExtractResult> => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      // Small async pause so concurrency is measurable
      await Promise.resolve();
      current--;
      return { ok: false, error: { code: 'FETCH_FAILED', message: 'test' } };
    };

    const provider = makeFakeProvider(claims, verdicts);
    await auditCitations('text', { provider, apiKey: 'key', extractor: trackingExtractor, backoffDelaysMs: INSTANT_BACKOFF });

    // Concurrency within each batch should not exceed CITATION_FETCH_PARALLELISM
    expect(maxConcurrent).toBeLessThanOrEqual(CITATION_FETCH_PARALLELISM);
  });

  it('sorts results: mismatched → uncited → unfetchable → weakly_cited → well_cited', async () => {
    const claims = [
      { claim: 'Well',        evidenceQuote: 'Well',        citationUrl: 'https://example.org/w' },
      { claim: 'Uncited',     evidenceQuote: 'Uncited',     citationUrl: null },
      { claim: 'Mismatched',  evidenceQuote: 'Mismatched',  citationUrl: 'https://example.org/m' },
      { claim: 'Unfetchable', evidenceQuote: 'Unfetchable', citationUrl: 'https://example.org/u' },
    ];
    const verdicts = [
      { verdict: 'well_cited',  verdictExplanation: 'ok', sourceExcerpt: null, confidence: 90 },
      { verdict: 'mismatched',  verdictExplanation: 'wrong', sourceExcerpt: null, confidence: 88 },
    ];

    const extractor: (url: string) => Promise<ExtractResult> = async (url) => {
      if (url.includes('/u')) return { ok: false, error: { code: 'FETCH_FAILED', message: 'fail' } };
      return { ok: true, article: { title: 'T', publication: 'P', url, text: 'content' } };
    };

    const provider = makeFakeProvider(claims, verdicts);
    const { result } = await auditCitations('text', { provider, apiKey: 'key', extractor, backoffDelaysMs: INSTANT_BACKOFF });

    const verdictOrder = result.factualClaims.map(c => c.verdict);
    expect(verdictOrder[0]).toBe('mismatched');
    expect(verdictOrder[1]).toBe('uncited');
    expect(verdictOrder[2]).toBe('unfetchable');
    expect(verdictOrder[3]).toBe('well_cited');
  });

  it('accumulates tokens from Stage 1 and all Stage 2 calls', async () => {
    const claims = [
      { claim: 'A', evidenceQuote: 'A', citationUrl: 'https://example.org/1' },
      { claim: 'B', evidenceQuote: 'B', citationUrl: 'https://example.org/2' },
    ];
    const verdicts = [
      { verdict: 'well_cited',   verdictExplanation: 'ok', sourceExcerpt: null, confidence: 90 },
      { verdict: 'weakly_cited', verdictExplanation: 'ok', sourceExcerpt: null, confidence: 70 },
    ];
    const provider = makeFakeProvider(claims, verdicts);

    const { inputTokens, outputTokens } = await auditCitations(
      'text',
      { provider, apiKey: 'key', extractor: okExtractor(), backoffDelaysMs: INSTANT_BACKOFF },
    );

    // Stage 1: 10 in / 20 out; Stage 2 x2: 5+5 in / 10+10 out
    expect(inputTokens).toBe(20);
    expect(outputTokens).toBe(40);
  });
});
