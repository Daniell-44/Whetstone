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

/** Strip tags well enough to search prose. Not a parser, and does not need to be. */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

export interface GroundedResult {
  text: string;
  chunks: GroundingChunk[];
  searchQueries: string[];
}

/** Stage 1. One grounded call. Returns prose plus the pages actually consulted. */
export async function retrievePremise(
  premise: string,
  apiKey: string,
  model = 'gemini-2.5-flash',
): Promise<GroundedResult> {
  // Phrased as a QUESTION, deliberately. The first version of this opened with
  // "CLAIM: ..." followed by instructions, and the model read that as a request
  // to report on something it already knew and ran no searches at all: zero
  // chunks, zero queries. Asking who has publicly disputed a thing makes
  // searching the obvious move.
  const prompt = [
    `Who has publicly argued about this claim, on either side: "${premise}"`,
    '',
    'Name the people and institutions. Never "critics" or "some experts".',
    'For each, give the exact wording they used, copied from the page, and the link.',
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

/**
 * Stage 2. Fetch each source and check the quote is really on the page.
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
