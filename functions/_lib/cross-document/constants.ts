export const CROSSDOC_SYNTHESIS_MODEL          = 'gemini-2.5-pro'; // careful cross-corpus reasoning
export const CROSSDOC_SYNTHESIS_THINKING_BUDGET = 8192;

export const MAX_DOCUMENTS        = 5;
export const MIN_DOCUMENTS        = 2;
export const MAX_PARALLEL_AUDITS  = 3;
export const DOCUMENT_MAX_CHARS   = 10_000;
export const DOCUMENT_MIN_CHARS   = 50;
// Preview length stored / echoed back for each document (keep payloads small)
export const DOCUMENT_PREVIEW_CHARS = 500;
