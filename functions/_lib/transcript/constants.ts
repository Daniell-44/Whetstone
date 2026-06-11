export const SEGMENT_MODEL              = 'gemini-2.5-flash';
export const SEGMENT_THINKING_BUDGET    = 4096;

export const PER_SEGMENT_AUDIT_MODEL    = 'gemini-2.5-flash';

export const SYNTHESIS_MODEL            = 'gemini-2.5-pro';
export const SYNTHESIS_THINKING_BUDGET  = 8192;

// Caps to control cost and latency.
export const MAX_SEGMENTS_PER_TRANSCRIPT = 12;   // cap per-segment audits
export const MAX_PARALLEL_AUDITS         = 4;
export const TRANSCRIPT_MAX_CHARS        = 60_000;  // ~10k words ≈ 1 hour of speech

// YouTube fetch
export const YOUTUBE_FETCH_TIMEOUT_MS    = 8_000;
