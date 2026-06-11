import { fetchAndExtract, extractArticleFromHtml } from './article';
import type { ExtractResult } from './article';

// ---------------------------------------------------------------------------
// Scraper fallback for URL extraction.
//
// Many news sites (Sky News, most paywalled/protected publishers) block plain
// server fetches or render content via JS that Readability can't see in raw
// HTML. When the direct fetch fails, we retry through a JS-rendering scraping
// API (ScrapingBee) which returns the fully-rendered HTML.
//
// Setup:
//   1. Sign up at scrapingbee.com (free trial: 1,000 credits)
//   2. Copy your API key from the dashboard
//   3. Set it as a Worker secret:
//        npx wrangler secret put SCRAPINGBEE_API_KEY --config dist/server/wrangler.json
//
// Cost: ~1 credit for a simple page, ~5-25 credits with render_js + premium
// proxy. At ~$0.001-0.005 per fetch, only triggered when the free direct
// fetch fails — so most audits never hit it.
//
// If no API key is configured, this transparently behaves exactly like the
// plain fetchAndExtract (returns its error). Nothing breaks without the key.
// ---------------------------------------------------------------------------

const SCRAPINGBEE_ENDPOINT = 'https://app.scrapingbee.com/api/v1/';
const SCRAPER_TIMEOUT_MS   = 25_000;

// Error codes from the direct fetch that are worth retrying via the scraper.
// (TOO_SHORT means we DID get content but it was thin — scraping won't help.)
const RETRYABLE_CODES = new Set(['FETCH_FAILED', 'NOT_HTML', 'EXTRACTION_FAILED']);

export interface ScraperDeps {
  scrapingBeeApiKey?: string;
  fetchImpl?:         typeof fetch;
}

/**
 * Try the cheap direct fetch first; on a retryable failure, fall back to the
 * JS-rendering scraper if a key is configured.
 */
export async function fetchAndExtractWithFallback(
  url:  string,
  deps: ScraperDeps = {},
): Promise<ExtractResult> {
  const fetchFn = deps.fetchImpl ?? fetch;

  // Stage 1 — cheap direct fetch.
  const direct = await fetchAndExtract(url, { fetchImpl: fetchFn });
  if (direct.ok) return direct;

  // No key, or non-retryable failure → return the direct error as-is.
  if (!deps.scrapingBeeApiKey || !RETRYABLE_CODES.has(direct.error.code)) {
    return direct;
  }

  // Stage 2 — scraper fallback (JS render + premium proxy).
  const params = new URLSearchParams({
    api_key:       deps.scrapingBeeApiKey,
    url,
    render_js:     'true',
    premium_proxy: 'true',
    // Block images/css/fonts to keep credit cost down — we only want text.
    block_resources: 'true',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS);

  try {
    const res = await fetchFn(`${SCRAPINGBEE_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      // Scraper failed too — surface the original (more user-meaningful) error.
      console.warn(`[scraper] ScrapingBee returned ${res.status} for ${url}`);
      return direct;
    }
    const html = await res.text();
    const scraped = extractArticleFromHtml(html, url);
    // If the scraper got us readable content, return it; otherwise the original error.
    return scraped.ok ? scraped : direct;
  } catch (err) {
    console.warn(`[scraper] fallback error for ${url}: ${err instanceof Error ? err.message : err}`);
    return direct;
  } finally {
    clearTimeout(timer);
  }
}
