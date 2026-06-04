export const EVIDENCE_MODEL               = 'gemini-2.5-pro';
export const EVIDENCE_THINKING_BUDGET     = 8192;

// Semantic Scholar API
export const S2_API_BASE                  = 'https://api.semanticscholar.org/graph/v1';
export const S2_SEARCH_FIELDS             = 'paperId,title,year,citationCount,influentialCitationCount,abstract,url,tldr';
export const S2_MAX_PAPERS_PER_QUERY      = 10;
export const S2_FETCH_TIMEOUT_MS          = 8_000;

// Per-audit limits
export const MAX_CLAIMS_TO_ASSESS         = 8;   // only assess first N empirical_contested claims
export const S2_REQUEST_DELAY_MS          = 150;  // throttle between S2 requests (shared rate limit)
