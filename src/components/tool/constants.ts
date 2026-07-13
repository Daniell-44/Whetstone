// Shared tool primitives — the audit input contract, identical for the Reader
// (/audit, AuditForm) and Studio (/creator/studio, StudioEditor). Stage 2 of
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
export const READER_AUDIT_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED:      "You've reached the daily audit limit. Come back tomorrow to run more audits.",
  EXTRACTION_FAILED: "Couldn't extract the article text from that URL. Try pasting the text directly instead.",
  TOO_SHORT:         'The extracted text was too short to audit. Try pasting the full article text directly.',
  NOT_HTML:          "That URL doesn't point to an HTML page. Try pasting the text directly instead.",
  FETCH_FAILED:      "Couldn't reach that URL - check it's publicly accessible, or paste the text directly.",
  AUDIT_FAILED:      'The analysis failed. Please try again in a moment.',
  INVALID_INPUT:     'Please check your input and try again.',
};
