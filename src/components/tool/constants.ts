// Shared tool primitives — the audit input contract, identical for the Reader
// (AuditForm) and Create (StudioEditor), both hosted by ToolSurface at /audit.
// the audit/Studio merge: one source of truth so the two surfaces can't drift
// on the basics (a bounds change or a URL-detection tweak lands in both).

/** Minimum characters an audit will accept (URLs are exempt — they always pass). */
export const MIN_CHARS = 50;

/** Maximum characters an audit will accept before the input must be trimmed. */
export const MAX_CHARS = 10_000;

/**
 * A single pasted token starting with http(s) and containing no whitespace is
 * treated as a URL to fetch; anything else is treated as argument text.
 */
export const URL_RE = /^https?:\/\/\S+$/i;

/** Whitespace-delimited word count, matching how both surfaces size a draft. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Friendly copy for the anonymous audit endpoint's error codes (/api/audit,
 * which also owns the URL-fetch failure modes). Shared by the Reader and the
 * workbench so the two can't drift on error wording.
 */
// NB: no RATE_LIMITED override anywhere in this file. The server computes the
// real reset time for the caller's rolling window and says it ("the next one
// unlocks in about 5 hours"); a client-side string cannot know that number and
// the old one ("come back tomorrow") was wrong by up to 24 hours for anyone who
// spent their allowance mid-evening. Let the server message through.
export const READER_AUDIT_ERROR_MESSAGES: Record<string, string> = {
  EXTRACTION_FAILED: "Couldn't extract the article text from that URL. Try pasting the text directly instead.",
  TOO_SHORT:         'The extracted text was too short to audit. Try pasting the full article text directly.',
  NOT_HTML:          "That URL doesn't point to an HTML page. Try pasting the text directly instead.",
  FETCH_FAILED:      "Couldn't reach that URL - check it's publicly accessible, or paste the text directly.",
  AUDIT_FAILED:      'The analysis failed. Please try again in a moment.',
  INVALID_INPUT:     'Please check your input and try again.',
};
