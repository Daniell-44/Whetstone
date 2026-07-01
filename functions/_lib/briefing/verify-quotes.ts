// Quote provenance: confirm that every ::takes / position quote in a briefing
// is actually present at its source URL. Pure logic here (normalise + match +
// collect); the network fetch lives in scripts/verify-quotes.ts so this stays
// testable without hitting the wire. Closes the fabrication gap — a curated
// quote that can't be found at its source is flagged before publish.

import type { BriefingArticle } from './types';

export interface QuoteCheck {
  where: string; // e.g. "takes:Cato Institute" or "position:Price floors cut jobs"
  quote: string;
  url:   string;
}

export type MatchMethod = 'exact' | 'fuzzy' | 'none';

// Lowercase, unify smart quotes / dashes, collapse whitespace — so trivial
// typographic differences don't read as fabrication.
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\\/g, '')       // LaTeX-escaped punctuation in academic abstracts (e.g. arXiv "15\%") is cosmetic
    .replace(/\s+/g, ' ')
    .trim();
}

// Is `quote` present in `body`? Exact after normalisation, else a fuzzy check
// that tolerates trimmed edges (the author dropped a leading/trailing word).
export function quoteMatch(quote: string, body: string): MatchMethod {
  // Strip wrapping quotation marks — authors often quote the quote.
  const nq = normalizeForMatch(quote).replace(/^["']+/, '').replace(/["']+$/, '').trim();
  const nb = normalizeForMatch(body);
  if (!nq) return 'none';
  if (nb.includes(nq)) return 'exact';

  const words = nq.split(' ');
  if (words.length >= 5) {
    const core = words.slice(Math.floor(words.length * 0.1), Math.ceil(words.length * 0.9)).join(' ');
    if (core && nb.includes(core)) return 'fuzzy';
  }
  return 'none';
}

// Every (quote, url) worth verifying: each ::takes item, plus any ::position
// that carries an explicit quote= attr (its url comes from the linked source).
export function collectQuoteChecks(b: BriefingArticle): QuoteCheck[] {
  const urlById = new Map(b.sources.map((s) => [s.id, s.url]));
  const checks: QuoteCheck[] = [];
  for (const block of b.blocks) {
    if (block.type === 'takes') {
      for (const t of block.items) {
        if (t.quote && t.url) checks.push({ where: `takes:${t.source || '?'}`, quote: t.quote, url: t.url });
      }
    } else if (block.type === 'position' && block.quote) {
      const url = urlById.get(block.sourceId);
      if (url) checks.push({ where: `position:${block.label || block.sourceId}`, quote: block.quote, url });
    }
  }
  return checks;
}
