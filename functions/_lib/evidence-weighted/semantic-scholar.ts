import type { SemanticScholarPaper } from './types';
import { S2_API_BASE, S2_SEARCH_FIELDS, S2_MAX_PAPERS_PER_QUERY, S2_FETCH_TIMEOUT_MS } from './constants';

// ---------------------------------------------------------------------------
// Search Semantic Scholar for papers relevant to a claim
// ---------------------------------------------------------------------------

interface S2SearchResponse {
  total:  number;
  data:   S2PaperRaw[];
}

interface S2PaperRaw {
  paperId:                   string;
  title:                     string;
  year:                      number | null;
  citationCount:             number;
  influentialCitationCount:  number;
  abstract:                  string | null;
  url:                       string;
  tldr:                      { text: string } | null;
}

export async function searchPapers(
  query: string,
  opts?: { limit?: number; yearStart?: number },
): Promise<SemanticScholarPaper[]> {
  const limit    = opts?.limit ?? S2_MAX_PAPERS_PER_QUERY;
  const params   = new URLSearchParams({
    query,
    fields: S2_SEARCH_FIELDS,
    limit:  String(limit),
  });

  if (opts?.yearStart) {
    params.set('year', `${opts.yearStart}-`);
  }

  const url = `${S2_API_BASE}/paper/search?${params.toString()}`;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), S2_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TheWhetstone/1.0 (argument-auditor)' },
      signal:  controller.signal,
    });

    if (!res.ok) {
      // Semantic Scholar returns 429 when rate-limited; degrade gracefully
      if (res.status === 429) return [];
      return [];
    }

    const body = (await res.json()) as S2SearchResponse;

    return (body.data ?? []).map((p) => ({
      paperId:                  p.paperId,
      title:                    p.title,
      year:                     p.year,
      citationCount:            p.citationCount ?? 0,
      influentialCitationCount: p.influentialCitationCount ?? 0,
      abstract:                 p.abstract,
      url:                      p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
      tldr:                     p.tldr,
    }));
  } catch {
    // Network error or timeout — degrade gracefully
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Build a search query from a claim
// ---------------------------------------------------------------------------

// Strip rhetorical phrasing and reduce to a search-friendly keyword query.
// This is intentionally simple — the LLM-generated claim text from extraction
// is already fairly clean. We just trim length and remove common logical
// connectives that pollute keyword search.
const NOISE_WORDS = /\b(therefore|however|furthermore|moreover|consequently|thus|hence|clearly|obviously|arguably|necessarily)\b/gi;

export function claimToSearchQuery(claim: string): string {
  return claim
    .replace(NOISE_WORDS, '')
    .replace(/[★]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 200);
}
