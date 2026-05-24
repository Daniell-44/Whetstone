// Article extraction from raw HTML.
//
// Uses linkedom for DOM parsing (Cloudflare Workers-compatible; no native Node
// modules). @mozilla/readability is intentionally omitted here: its type
// declarations reference the browser global `Document`, which is absent in
// tsconfig.functions.json ("lib": ["ESNext"] only). The hand-rolled approach
// below is explicitly allowed by the build brief and works cleanly in all
// environments.

import { parseHTML } from 'linkedom';

// ---------------------------------------------------------------------------
// Result contract
// ---------------------------------------------------------------------------

export type ExtractResult =
  | { ok: true;  article: { title: string; publication: string; url: string; text: string } }
  | { ok: false; error:   { code: ErrorCode; message: string } };

export type ErrorCode = 'FETCH_FAILED' | 'NOT_HTML' | 'EXTRACTION_FAILED' | 'TOO_SHORT';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_WORD_COUNT  = 250;
const MIN_PARA_CHARS  = 20;    // paragraphs shorter than this are likely nav/button text
const MAX_HTML_BYTES  = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const STRIP_TAGS = [
  'script', 'style', 'nav', 'header', 'footer',
  'aside', 'form', 'button', 'noscript', 'iframe', 'figure', 'figcaption',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function metaContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  selector: string,
): string {
  return (doc.querySelector(selector)?.getAttribute('content') ?? '').trim();
}

// ---------------------------------------------------------------------------
// extractArticleFromHtml — pure, synchronous, no network
// ---------------------------------------------------------------------------

export function extractArticleFromHtml(html: string, url: string): ExtractResult {
  // doc is typed as `any` to avoid DOM-lib dependency under tsconfig.functions.json.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let doc: any;
  try {
    doc = (parseHTML(html) as unknown as { document: unknown }).document;
  } catch {
    return { ok: false, error: { code: 'EXTRACTION_FAILED', message: 'Failed to parse HTML' } };
  }

  // Title: og:title → <title>
  const ogTitle = metaContent(doc, 'meta[property="og:title"]');
  const title   = ogTitle || (doc.title ?? '').trim();

  // Publication: og:site_name → stripped hostname
  const siteName = metaContent(doc, 'meta[property="og:site_name"]');
  let publication: string;
  if (siteName) {
    publication = siteName;
  } else {
    try {
      publication = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      publication = url;
    }
  }

  // Content root: <article> → <main> → <body>
  const root = doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body;
  if (!root) {
    return { ok: false, error: { code: 'EXTRACTION_FAILED', message: 'No content root found in document' } };
  }

  // Strip structural noise in place.
  for (const tag of STRIP_TAGS) {
    for (const el of [...root.querySelectorAll(tag)]) {
      el.remove();
    }
  }

  // Collect paragraph text, filtering out nav-link-length snippets.
  const paragraphs: string[] = [];
  for (const p of root.querySelectorAll('p')) {
    const text = (p.textContent as string ?? '').replace(/\s+/g, ' ').trim();
    if (text.length >= MIN_PARA_CHARS) paragraphs.push(text);
  }

  if (paragraphs.length === 0) {
    return {
      ok: false,
      error: { code: 'EXTRACTION_FAILED', message: 'No paragraph content found in document' },
    };
  }

  const text      = paragraphs.join('\n\n');
  const wordCount = countWords(text);

  if (wordCount < MIN_WORD_COUNT) {
    return {
      ok: false,
      error: {
        code:    'TOO_SHORT',
        message: `Extracted ${wordCount} words; minimum is ${MIN_WORD_COUNT}`,
      },
    };
  }

  return { ok: true, article: { title, publication, url, text } };
}

// ---------------------------------------------------------------------------
// fetchAndExtract — network fetch, then delegates to extractArticleFromHtml
// ---------------------------------------------------------------------------

export async function fetchAndExtract(
  url:   string,
  deps?: { fetchImpl?: typeof fetch },
): Promise<ExtractResult> {
  const fetchFn    = deps?.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetchFn(url, {
        signal:   controller.signal,
        redirect: 'follow',
        headers:  {
          'User-Agent': USER_AGENT,
          'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } catch (err) {
      return {
        ok: false,
        error: {
          code:    'FETCH_FAILED',
          message: `Network error: ${err instanceof Error ? err.message : 'unknown'}`,
        },
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: { code: 'FETCH_FAILED', message: `HTTP ${response.status} from server` },
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return {
        ok: false,
        error: {
          code:    'NOT_HTML',
          message: `Response Content-Type '${contentType}' is not text/html`,
        },
      };
    }

    // Stream body and cap at MAX_HTML_BYTES.
    const reader = response.body?.getReader();
    if (!reader) {
      return { ok: false, error: { code: 'FETCH_FAILED', message: 'Response body is not readable' } };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        if (totalBytes + value.byteLength > MAX_HTML_BYTES) {
          const slice = value.slice(0, MAX_HTML_BYTES - totalBytes);
          chunks.push(slice);
          totalBytes += slice.byteLength;
          break;
        }
        chunks.push(value);
        totalBytes += value.byteLength;
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    // Merge chunks into a single buffer.
    const merged = new Uint8Array(totalBytes);
    let offset   = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const html = new TextDecoder().decode(merged);
    return extractArticleFromHtml(html, url);

  } finally {
    clearTimeout(timer);
  }
}
