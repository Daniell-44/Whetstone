// Derives a URL-safe slug from a free-text question string.
export function deriveSlug(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Returns true when count is within the allowed position range (2–5).
export function isPositionCountValid(count: number): boolean {
  return count >= 2 && count <= 5;
}

// Returns true when every position has a non-empty label and at least one
// article with non-empty text — the minimum needed to call the engine.
export function arePositionsReadyForGeneration(
  positions: Array<{ label: string; articles: Array<{ text: string }> }>,
): boolean {
  if (!isPositionCountValid(positions.length)) return false;
  return positions.every(
    pos =>
      pos.label.trim().length > 0 &&
      pos.articles.some(a => a.text.trim().length > 0),
  );
}
