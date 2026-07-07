// Audit signature — the per-briefing aggregation of audit findings that the
// feed cards surface (D1 Option B, 2026-07-07). This is the "visible at zero
// clicks" differentiator: named-fallacy chips + audited-position count +
// groundedness mix, derived entirely from what the article already carries.

import type { BriefingArticle } from './types';

export interface AuditSignature {
  /** Named findings from position audits, deduped, in order of appearance. */
  fallacies:        string[];
  /** Position blocks carrying a named audit. */
  auditedPositions: number;
  /** Curated external takes carrying an audit note. */
  auditedTakes:     number;
  /** Groundedness mix across named position audits. */
  kinds:            { structural: number; interpretive: number; empirical: number };
  /** Featured-card excerpt: the first audited position's verbatim quote + finding. */
  lead?:            { quote: string; fallacy: string };
}

export function auditSignature(b: BriefingArticle): AuditSignature {
  const sig: AuditSignature = {
    fallacies:        [],
    auditedPositions: 0,
    auditedTakes:     0,
    kinds:            { structural: 0, interpretive: 0, empirical: 0 },
  };

  for (const bl of b.blocks) {
    if (bl.type === 'position' && bl.audit.name) {
      sig.auditedPositions += 1;
      sig.kinds[bl.audit.kind] += 1;
      if (!sig.fallacies.includes(bl.audit.name)) sig.fallacies.push(bl.audit.name);
      if (!sig.lead && bl.quote) sig.lead = { quote: bl.quote, fallacy: bl.audit.name };
    } else if (bl.type === 'takes') {
      sig.auditedTakes += bl.items.filter((t) => t.audit.trim() !== '').length;
    }
  }

  return sig;
}
