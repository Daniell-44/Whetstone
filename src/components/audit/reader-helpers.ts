// ---------------------------------------------------------------------------
// Pure helpers for the Reader (/audit) surface. Kept out of the island so the
// Node-environment Vitest suite can exercise them directly.
// ---------------------------------------------------------------------------

// localStorage key set to '1' once the visitor dismisses the groundedness
// definition strip. Until then the strip shows automatically with the first
// result of a session.
export const GROUNDEDNESS_SEEN_KEY = 'whetstone_groundedness_seen';

export function hasSeenGroundednessDefs(): boolean {
  try {
    return localStorage.getItem(GROUNDEDNESS_SEEN_KEY) === '1';
  } catch {
    // Storage unavailable: treat as unseen so first-timers still get the
    // strip. Dismissal just won't persist across visits.
    return false;
  }
}

export function markGroundednessDefsSeen(): void {
  try {
    localStorage.setItem(GROUNDEDNESS_SEEN_KEY, '1');
  } catch { /* storage unavailable */ }
}

// The /api/audit-link body caps draftText at 10,000 chars (only a 200-char
// snippet is stored). URL audits can carry longer extracted article bodies,
// so trim client-side rather than letting the share request 400.
export const SHARE_DRAFT_MAX_CHARS = 10_000;

export function truncateForShare(text: string, max = SHARE_DRAFT_MAX_CHARS): string {
  return text.length > max ? text.slice(0, max) : text;
}

// Label for the verdict-bar door into the mobile findings sheet. Zero-finding
// audits still have a sheet (empty state + argument structure), so the label
// drops the count rather than reading "the 0 findings".
export function findingsSheetButtonLabel(total: number): string {
  if (total === 0) return 'See the findings';
  return `See the ${total} ${total === 1 ? 'finding' : 'findings'}`;
}
