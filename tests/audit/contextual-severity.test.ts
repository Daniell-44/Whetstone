import { describe, it, expect } from 'vitest';
import { matchStatement, loadFactor, contextualSeverity } from '../../functions/_lib/audit/contextual-severity';
import type { ExtractionStatement, ArgumentExtractionResult } from '../../functions/_lib/argument-extraction/types';

const statements: ExtractionStatement[] = [
  { id: 'P1', type: 'premise', claimType: 'empirical_contested', text: 'Increasing the minimum wage will reduce youth employment.', derivedFrom: [], inferenceRule: null },
  { id: 'P2', type: 'premise', claimType: 'normative', text: 'We should not do things that harm the most economically vulnerable.', derivedFrom: [], inferenceRule: null },
  { id: 'P3', type: 'premise', claimType: 'empirical_uncontested', text: 'Unemployment statistics are collected on a monthly basis.', derivedFrom: [], inferenceRule: null },
  { id: 'C1', type: 'conclusion', claimType: 'normative', text: 'The minimum wage should not be increased.', derivedFrom: ['P1', 'P2'], inferenceRule: 'categorical_syllogism' },
];
const extraction = { centralClaim: '', statements, notes: null, groundedness: { kind: 'interpretive', band: 'plausible' } } as unknown as ArgumentExtractionResult;

describe('matchStatement', () => {
  it('matches a quote to the statement it is about', () => {
    expect(matchStatement('increasing the minimum wage will reduce youth employment', statements)?.id).toBe('P1');
    expect(matchStatement('the minimum wage should not be increased', statements)?.id).toBe('C1');
  });
  it('returns null when nothing clears the overlap threshold', () => {
    expect(matchStatement('the weather in Paris was pleasant', statements)).toBeNull();
  });
});

describe('loadFactor', () => {
  it('ranks conclusion > load-bearing premise > aside > unmatched', () => {
    const byId = (id: string) => statements.find(s => s.id === id)!;
    expect(loadFactor(byId('C1'), statements)).toBe(1.3);   // conclusion
    expect(loadFactor(byId('P1'), statements)).toBe(1.15);  // premise C1 derives from
    expect(loadFactor(byId('P3'), statements)).toBe(0.95);  // aside — no conclusion uses it
    expect(loadFactor(null, statements)).toBe(0.85);        // couldn't place it
  });
});

describe('contextualSeverity', () => {
  it('downgrades a high finding that lands on an incidental, uncontested aside', () => {
    const r = contextualSeverity({ quote: 'Unemployment statistics are collected on a monthly basis', severity: 'high' }, extraction);
    expect(r.baseBand).toBe('high');
    expect(r.band).toBe('medium');            // 3 × 0.9 × 0.95 = 2.565 → medium
    expect(r.matchedStatementId).toBe('P3');
  });

  it('keeps a high finding on the conclusion at high', () => {
    const r = contextualSeverity({ quote: 'The minimum wage should not be increased', severity: 'high' }, extraction);
    expect(r.band).toBe('high');              // 3 × 1.0 × 1.3 = 3.9 → high
    expect(r.reason).toContain('conclusion');
  });

  it('flags a load-bearing contested premise in its reason', () => {
    const r = contextualSeverity({ quote: 'Increasing the minimum wage will reduce youth employment', severity: 'medium' }, extraction);
    expect(r.matchedStatementId).toBe('P1');
    expect(r.reason).toContain('load-bearing');
    expect(r.reason).toContain('contested empirical');
  });

  it('is a no-op-ish passthrough when there is no extraction', () => {
    const r = contextualSeverity({ quote: 'anything', severity: 'medium' }, null);
    expect(r.baseBand).toBe('medium');
    expect(r.matchedStatementId).toBeNull();
    expect(r.band).toBe('medium');            // 2 × 1 × 0.85 = 1.7 → medium
  });
});
