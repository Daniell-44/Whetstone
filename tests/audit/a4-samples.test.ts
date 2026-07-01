import { describe, it, expect } from 'vitest';
import { SAMPLES } from '../../src/data/samples';
import { contextualSeverity } from '../../functions/_lib/audit/contextual-severity';
import type { AuditResult } from '../../functions/_lib/audit/types';

// Regression guard for A4's context-sensitive severity, run against the REAL
// cached sample audits (no API). It locks in the two properties that the offline
// A/B (evals/a4-rebanding.ts) established, so the phase-1 "blanket downgrade" bug
// can never silently return:
//   1. an UNMATCHED finding never changes band (findings quote rhetoric that the
//      join can't place — they must be left exactly as the model rated them);
//   2. every shift is at most one band (±1, conservative).

function spanFindings(a: AuditResult): { quote: string; sev: 'high' | 'medium' | 'low' }[] {
  return [
    ...a.namedFallacies.map(f => ({ quote: f.quote, sev: f.severity })),
    ...a.loadedLanguage.map(l => ({ quote: l.phrase, sev: l.severity })),
    ...(a.keyTermScrutiny      ?? []).map(f => ({ quote: f.usage_a, sev: f.severity })),
    ...(a.referentChecks       ?? []).map(f => ({ quote: f.evidence, sev: f.severity })),
    ...(a.falsifiabilityChecks ?? []).map(f => ({ quote: f.evidence, sev: f.severity })),
    ...(a.modalScopeChecks     ?? []).map(f => ({ quote: f.evidence, sev: f.severity })),
  ];
}

describe('A4 context-severity over cached samples', () => {
  for (const s of SAMPLES) {
    it(`${s.shortLabel}: unmatched findings never move, shifts stay within one band`, () => {
      let matched = 0;
      for (const f of spanFindings(s.cached.audit)) {
        const cs = contextualSeverity({ quote: f.quote, severity: f.sev }, s.cached.extraction);
        if (cs.matchedStatementId === null) {
          expect(cs.band, `unmatched "${f.quote.slice(0, 30)}" must keep its band`).toBe(f.sev);
        } else {
          matched++;
        }
        expect(Math.abs(cs.delta)).toBeLessThanOrEqual(1);
      }
      // Sanity: the join actually places at least one finding (guards against a
      // future change that silently matches nothing, making A4 inert).
      expect(matched).toBeGreaterThan(0);
    });
  }
});
