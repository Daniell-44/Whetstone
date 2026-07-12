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
