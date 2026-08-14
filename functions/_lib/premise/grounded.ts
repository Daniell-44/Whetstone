/**
 * The grounded premise card: sources retrieved, then quotes checked against the
 * page they are claimed to come from.
 *
 * WHY THIS EXISTS. The first prototype asked the model to recall who argues
 * what. It confabulated fluently: it returned my own input sentence as a named
 * politician's quote, attached to a real URL where that sentence does not
 * appear, and invented a second URL outright. That is not a prompting problem
 * and cannot be fixed by asking more firmly.
 *
 * The nuclear briefing's sources were not found that way. They were found by
 * searching, and the quotes were checked by fetching the page and matching the
 * text. This does the same thing, in code, in two stages:
 *
 *   1. RETRIEVE. One Gemini call with Google Search grounding on. The model
 *      reads real results rather than its own memory, and the response carries
 *      groundingMetadata listing the actual pages consulted. No separate search
 *      vendor and no new subscription: it is a tool flag on a call we already
 *      make.
 *   2. VERIFY. Every proposed quote is fetched from its own URL and matched
 *      character-exact against the page text. Anything that does not match is
 *      DROPPED, not softened. A card can come back with no quotes at all, and
 *      that is a good outcome compared to one invented quote.
 *
 * Grounding and JSON response mode are mutually exclusive in the Gemini API, so
 * stage 1 returns prose and the JSON is asked for separately. That is the cost
 * of grounding and it is worth paying.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GroundedSource {
  who: string;
  publication?: string;
  position: string;
  quote?: string;
  url?: string;
  /** Set by verify(): did this exact wording appear on that page? */
  verified?: boolean;
  /** Why a quote was dropped, when it was. */
  verifyNote?: string;
  /**
   * The publisher's own URL, resolved by following the redirect.
   *
   * Grounding hands back vertexaisearch.cloud.google.com redirect links, not
   * the real article address, and those expire. Citing one would give this
   * publication a footnote that dies quietly in a few weeks, which is the exact
   * failure the dated-receipt work exists to prevent. So the fetch that checks
   * the quote also records where it actually landed, and that is what gets
   * cited.
   */
  resolvedUrl?: string;
}

export interface GroundingChunk {
  uri: string;
  title?: string;
}

/** Squeeze for comparison: quote gates must survive curly quotes and reflowed whitespace. */
export function squeeze(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const ENTITIES: Record<string, string> = {
  quot: '"', apos: "'", lsquo: '‘', rsquo: '’', sbquo: '‚',
  ldquo: '“', rdquo: '”', bdquo: '„', ndash: '–', mdash: '—',
  hellip: '…', nbsp: ' ', lt: '<', gt: '>', deg: '°', pound: '£',
  euro: '€', middot: '·', bull: '•', prime: '′', Prime: '″',
};

/**
 * Strip tags well enough to search prose. Not a parser, and does not need to be.
 *
 * Entity decoding is not cosmetic here. A quote is copied out of THIS text by
 * the model and then shown to a reader, so an entity left undecoded appears
 * verbatim in the publication: a live run produced `nuclear energy&rsquo;s`
 * inside a quotation. Named entities are decoded first and `&amp;` last, so
 * that a literal `&amp;rsquo;` on the page stays literal instead of turning
 * into an apostrophe.
 */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

export interface GroundedResult {
  text: string;
  chunks: GroundingChunk[];
  searchQueries: string[];
}

/**
 * What the search is FOR.
 *
 *   'survey'   both sides, weighted honestly. The default, and what a premise
 *              card wants: it is describing a debate.
 *   'dispute'  the strongest published objection first. What the mini-briefing
 *              wants, because the reader is holding the article's own case
 *              already and a search that returns agreement has told them
 *              nothing they did not have when they started.
 *
 * 'dispute' does not ask for a hostile answer. It asks the search to look
 * where the article is not looking, and it still requires the model to say so
 * plainly when no objection exists.
 */
export type RetrievalAngle = 'survey' | 'dispute';

/** Stage 1. One grounded call. Returns prose plus the pages actually consulted. */
export async function retrievePremise(
  premise: string,
  apiKey: string,
  model = 'gemini-2.5-flash',
  angle: RetrievalAngle = 'survey',
): Promise<GroundedResult> {
  // Phrased as a QUESTION, deliberately. The first version of this opened with
  // "CLAIM: ..." followed by instructions, and the model read that as a request
  // to report on something it already knew and ran no searches at all: zero
  // chunks, zero queries. Asking who has publicly disputed a thing makes
  // searching the obvious move.
  //
  // The claim is NOT wrapped in quotation marks, and the last line says why.
  // Quoting it produced searches like:  "A nuclear-inclusive grid costs 25 per
  // cent less than a renewables-only grid" objections  which is an exact-phrase
  // search for a sentence written thirty seconds earlier by another model. It
  // matched nothing, so the call came back with zero chunks and empty text, and
  // the premise was silently dropped. Measured, twice, on the same claim.
  const prompt = [
    `Who has publicly argued about this claim, on either side: ${premise}`,
    ...(angle === 'dispute'
      ? ['', 'Look hardest for the objections: who says this is wrong, and what do they say instead.']
      : []),
    '',
    'Search in ordinary language for the subject itself. Do not search for the sentence',
    'above as an exact phrase; it was written for this task and nobody has published it.',
    '',
    'Name the people and institutions. Never "critics" or "some experts".',
    'For each, give the exact wording they used, copied from the page, and the link.',
    'Stay on the exact quantity in the claim. A source about a related but different',
    'measure, a different country or a different period does not count as a response to it.',
    'If the weight of expert opinion is clearly one way, say so and name who dissents.',
    'If nobody is actually arguing about it, say that rather than inventing a disagreement.',
  ].join('\n');

  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      // Thinking is left ON here, unlike the ungrounded card: deciding what to
      // search for is exactly the kind of work it helps with. But it draws from
      // the same budget as the answer, which silently truncated the first
      // attempt to nothing, so the budget has to be large enough for both.
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) throw new Error(`grounded call failed: ${res.status} ${(await res.text()).slice(0, 300)}`);

  const body = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
        webSearchQueries?: string[];
      };
    }>;
  };
  const cand = body.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const chunks: GroundingChunk[] = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => ({ uri: c.web?.uri ?? '', title: c.web?.title }))
    .filter((c) => c.uri);
  return { text, chunks, searchQueries: cand?.groundingMetadata?.webSearchQueries ?? [] };
}

export interface FetchedPage {
  url: string;
  resolvedUrl: string;
  title?: string;
  text: string;
}

/**
 * Fetch the pages grounding actually found, so quotes can be taken from real
 * text rather than from the model's account of it.
 *
 * This exists because of a measured failure, not a theory. Asking the grounded
 * model to report who said what WITH exact wording produced a discursive essay
 * rather than quotations, so the structuring pass had nothing exact to hand on
 * and the gate correctly dropped every single source. Reproducing a quotation
 * from memory is recall. Picking one out of text placed in front of the model
 * is reading. Only the second is reliable, so do the second.
 */
export interface FetchAttempt {
  url: string;
  resolvedUrl?: string;
  domain?: string;
  ms: number;
  status?: number;
  outcome: 'ok' | 'http_error' | 'too_short' | 'unreachable';
  chars?: number;
}

export interface FetchResult {
  pages: FetchedPage[];
  /**
   * Every attempt, including the failures.
   *
   * The failures were previously swallowed into `null` and discarded, which
   * made an important question unanswerable: when a briefing comes back thin,
   * is that because the search found nothing, because the pages would not
   * load, or because the model found nothing in pages that loaded fine? Those
   * are three different problems with three different fixes, and without this
   * they look identical from the outside.
   */
  ledger: FetchAttempt[];
}

function hostOf(u: string): string | undefined {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return undefined; }
}

export async function fetchPages(chunks: GroundingChunk[], limit = 5): Promise<FetchResult> {
  const attempts = await Promise.all(
    chunks.slice(0, limit).map(async (c): Promise<{ page: FetchedPage | null; attempt: FetchAttempt }> => {
      const t0 = Date.now();
      try {
        const r = await fetch(c.uri, {
          redirect: 'follow',
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; TheWhetstone/1.0)' },
          signal: AbortSignal.timeout(20_000),
        });
        const ms = Date.now() - t0;
        const domain = hostOf(r.url || c.uri);
        if (!r.ok) {
          return { page: null, attempt: { url: c.uri, resolvedUrl: r.url, domain, ms, status: r.status, outcome: 'http_error' } };
        }
        const text = pageText(await r.text()).replace(/\s+/g, ' ').trim();
        if (text.length < 400) {
          return { page: null, attempt: { url: c.uri, resolvedUrl: r.url, domain, ms, status: r.status, outcome: 'too_short', chars: text.length } };
        }
        return {
          page: { url: c.uri, resolvedUrl: r.url, title: c.title, text },
          attempt: { url: c.uri, resolvedUrl: r.url, domain, ms, status: r.status, outcome: 'ok', chars: text.length },
        };
      } catch {
        return { page: null, attempt: { url: c.uri, domain: hostOf(c.uri), ms: Date.now() - t0, outcome: 'unreachable' } };
      }
    }),
  );
  return {
    pages: attempts.map((a) => a.page).filter((p): p is FetchedPage => p !== null),
    ledger: attempts.map((a) => a.attempt),
  };
}

/**
 * Stage 3. Fetch each source and check the quote is really on the page.
 *
 * Drops rather than softens. A source whose page cannot be fetched is marked
 * unverified and keeps its position but loses its quote, because an unreachable
 * page is not evidence and must not look like it.
 */
export async function verifySources(sources: GroundedSource[]): Promise<GroundedSource[]> {
  return Promise.all(
    sources.map(async (s) => {
      if (!s.quote || !s.url) return { ...s, verified: false, verifyNote: 'no quote or no url offered' };
      const quote = s.quote;
      let html: string;
      let resolvedUrl: string | undefined;
      try {
        const r = await fetch(s.url, {
          redirect: 'follow',
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; TheWhetstone quote-check/1.0)' },
          signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) return { ...s, quote: undefined, verified: false, verifyNote: `source returned ${r.status}` };
        html = await r.text();
        // Where the redirect actually landed. This is the citable address.
        resolvedUrl = r.url;
      } catch (e) {
        return { ...s, quote: undefined, verified: false, verifyNote: `unreachable: ${(e as Error).message.slice(0, 60)}` };
      }
      const hay = squeeze(pageText(html));
      const needle = squeeze(quote).replace(/^["']|["']$/g, '');
      if (needle.length < 12) return { ...s, resolvedUrl, quote: undefined, verified: false, verifyNote: 'quote too short to check' };
      if (hay.includes(needle)) return { ...s, resolvedUrl, verified: true };
      return { ...s, resolvedUrl, quote: undefined, verified: false, verifyNote: 'wording not found on the page' };
    }),
  );
}
