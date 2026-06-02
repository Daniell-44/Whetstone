export const CITATION_CLAIM_EXTRACTION_MODEL = 'gemini-2.5-flash';
export const CITATION_VERDICT_MODEL          = 'gemini-2.5-flash';

// Hard cap on claims processed per audit call — controls cost and latency.
export const MAX_CITED_CLAIMS_PER_AUDIT   = 15;

// Timeout per URL fetch (ms).
export const CITATION_FETCH_TIMEOUT_MS    = 10_000;

// Maximum simultaneous URL fetches in-flight.
export const CITATION_FETCH_PARALLELISM   = 4;
