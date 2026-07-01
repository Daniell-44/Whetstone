/**
 * Homepage "Featured" band — the curated front page.
 *
 * This is the single surface that controls what renders large at the top of the
 * home feed, in order. Everything NOT listed here flows into the asymmetric
 * mosaic below, newest first. Edit this list to re-curate the front page; it is
 * meant to change over time (seasonal, topical, "editor's picks").
 *
 * Each entry must be the slug of a briefing/explainer in
 * src/content/briefings/<slug>.md. Unknown slugs are ignored at render time
 * (they simply don't appear), so a typo can't blank the feed.
 *
 * To change what's featured, just tell me here in chat — e.g. "feature
 * gene-editing-embryos and drop minimum-wage-jobs" — and I'll edit this file.
 */
export const featured: string[] = [
  'ai-creative-jobs',
  'minimum-wage-jobs',
];
