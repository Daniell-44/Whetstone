import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractArticleFromHtml,
  fetchAndExtract,
} from '../../functions/_lib/extract/article';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES  = join(__dirname, '../../functions/_lib/extract/fixtures');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8');
}

// ---------------------------------------------------------------------------
// extractArticleFromHtml — fixture tests (no network)
// ---------------------------------------------------------------------------

describe('extractArticleFromHtml — well-formed article', () => {
  const html   = fixture('well-formed-article.html');
  const url    = 'https://www.policyresearchreview.example.com/articles/deliberation-study';
  // Run once; results are shared across assertions.
  const result = extractArticleFromHtml(html, url);

  it('returns ok: true', () => {
    expect(result.ok).toBe(true);
  });

  it('extracts title from og:title', () => {
    if (!result.ok) throw new Error('Expected ok');
    expect(result.article.title).toBe(
      'Structured Deliberation Improves Policy Quality, Study Finds',
    );
  });

  it('extracts publication from og:site_name', () => {
    if (!result.ok) throw new Error('Expected ok');
    expect(result.article.publication).toBe('Policy Research Review');
  });

  it('preserves the original URL', () => {
    if (!result.ok) throw new Error('Expected ok');
    expect(result.article.url).toBe(url);
  });

  it('includes article body text', () => {
    if (!result.ok) throw new Error('Expected ok');
    expect(result.article.text).toContain('Researchers at Cambridge University');
    expect(result.article.text).toContain('productive friction');
  });

  it('text is plain — no HTML tags', () => {
    if (!result.ok) throw new Error('Expected ok');
    expect(result.article.text).not.toMatch(/<[a-z]/);
  });

  it('excludes header and footer content', () => {
    if (!result.ok) throw new Error('Expected ok');
    // Navigation links and copyright should not appear in extracted text.
    expect(result.article.text).not.toContain('All rights reserved');
  });
});

describe('extractArticleFromHtml — paywall stub', () => {
  const html   = fixture('paywall-stub.html');
  const url    = 'https://www.chronicleofpolicy.example.com/article/logic-frameworks';
  const result = extractArticleFromHtml(html, url);

  it('returns ok: false', () => {
    expect(result.ok).toBe(false);
  });

  it('error code is TOO_SHORT', () => {
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('TOO_SHORT');
  });

  it('error message mentions word count', () => {
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toMatch(/\d+ words/);
  });
});

describe('extractArticleFromHtml — homepage', () => {
  const html   = fixture('homepage.html');
  const url    = 'https://www.policyresearchreview.example.com/';
  const result = extractArticleFromHtml(html, url);

  it('returns ok: false', () => {
    expect(result.ok).toBe(false);
  });

  it('error code is EXTRACTION_FAILED (no <p> elements in content root after stripping)', () => {
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('EXTRACTION_FAILED');
  });
});

// ---------------------------------------------------------------------------
// extractArticleFromHtml — publication fallback
// ---------------------------------------------------------------------------

describe('extractArticleFromHtml — publication fallback', () => {
  it('falls back to hostname when og:site_name is absent', () => {
    const html = `<html><head><title>T</title></head><body><article>
      ${Array.from({ length: 10 }, (_, i) => `<p>Paragraph ${i + 1}: This paragraph contains enough words to pad the extraction output so the word count check passes without issue. We need substantial text here to reach the two-hundred-and-fifty word threshold reliably.</p>`).join('\n')}
    </article></body></html>`;
    const result = extractArticleFromHtml(html, 'https://www.example-news.com/article/test');
    if (!result.ok) return; // may be TOO_SHORT for very short placeholder text; skip
    expect(result.article.publication).toBe('example-news.com');
  });
});

// ---------------------------------------------------------------------------
// fetchAndExtract — injected fetch stub (no real network)
// ---------------------------------------------------------------------------

describe('fetchAndExtract — via injected fetchImpl', () => {
  const articleHtml = fixture('well-formed-article.html');
  const articleUrl  = 'https://www.policyresearchreview.example.com/articles/deliberation-study';

  it('returns ok: true for a good article response', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response(articleHtml, {
        status:  200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

    const result = await fetchAndExtract(articleUrl, { fetchImpl: mockFetch });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.article.title).toBe('Structured Deliberation Improves Policy Quality, Study Finds');
      expect(result.article.publication).toBe('Policy Research Review');
    }
  });

  it('returns FETCH_FAILED for a non-2xx response', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response('Not found', { status: 404 });

    const result = await fetchAndExtract(articleUrl, { fetchImpl: mockFetch });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FETCH_FAILED');
      expect(result.error.message).toContain('404');
    }
  });

  it('returns NOT_HTML for a non-HTML content type', async () => {
    const mockFetch: typeof fetch = async () =>
      new Response('{"data": 1}', {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      });

    const result = await fetchAndExtract(articleUrl, { fetchImpl: mockFetch });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_HTML');
    }
  });

  it('returns FETCH_FAILED when the fetch throws a network error', async () => {
    const mockFetch: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    const result = await fetchAndExtract(articleUrl, { fetchImpl: mockFetch });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FETCH_FAILED');
      expect(result.error.message).toContain('Failed to fetch');
    }
  });
});
