import type { Skeleton, Finding } from './schema';

/**
 * Locate a finding's verbatim quote inside the argument's skeleton — the
 * load-bearing condition of the fatal bar (fatal.ts).
 *
 * Audit quotes are verbatim article text; skeleton statements are extraction
 * paraphrases that usually keep the load-bearing words, so exact substring
 * matching would miss. We use token-set overlap against the smaller side with
 * a conservative threshold: an unmatched quote stays 'unknown', and the bar
 * never fires on 'unknown'. A too-shy tab beats a wrong accusation.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'is', 'are',
  'was', 'were', 'be', 'been', 'that', 'this', 'it', 'as', 'at', 'by', 'with',
  'from', 'has', 'have', 'had', 'will', 'would', 'not', 'but', 'its', 'their',
  'they', 'we', 'which', 'what', 'who',
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / Math.min(a.size, b.size);
}

const THRESHOLD = 0.6;

export function locateQuote(quote: string, skeleton: Skeleton): Finding['location'] {
  const q = tokens(quote);
  let bestWhere: Finding['location'] = 'unknown';
  let bestScore = 0;

  // Claims first: on a tie the conclusion wins (strict > below never displaces it).
  for (const claim of skeleton.claims) {
    const s = overlap(q, tokens(claim));
    if (s > bestScore) {
      bestScore = s;
      bestWhere = 'conclusion';
    }
  }
  for (const p of skeleton.premises) {
    const s = overlap(q, tokens(p.text));
    if (s > bestScore) {
      bestScore = s;
      // A non-crux premise is below the fatal bar's line; 'aside' is the
      // schema's word for that (P1 mapping, documented in the plan).
      bestWhere = p.crux ? 'crux-premise' : 'aside';
    }
  }
  return bestScore >= THRESHOLD ? bestWhere : 'unknown';
}
