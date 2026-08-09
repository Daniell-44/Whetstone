import { describe, it, expect } from 'vitest';
import { isFatal, fatalFindings } from '../../src/lib/argument-core/fatal';
import { FIXTURES } from '../../src/lib/argument-core/fixtures';
import type { Finding } from '../../src/lib/argument-core/schema';

const fatal: Finding = {
  name: 'The conclusion restates its own premise',
  quote: 'Prices have always risen, which is why they will keep rising.',
  explanation: 'Circular support.',
  severity: 'high',
  groundedness: 'structural',
  location: 'conclusion',
};

describe('the provisional fatal bar (all three conditions)', () => {
  it('fires on high + structural + conclusion', () => {
    expect(isFatal(fatal)).toBe(true);
  });

  it('fires on a crux premise as well as the conclusion', () => {
    expect(isFatal({ ...fatal, location: 'crux-premise' })).toBe(true);
  });

  it('does not fire below high severity', () => {
    expect(isFatal({ ...fatal, severity: 'medium' })).toBe(false);
    expect(isFatal({ ...fatal, severity: 'low' })).toBe(false);
  });

  it('does not fire on a judgment call — the tab must be provable from the quote', () => {
    expect(isFatal({ ...fatal, groundedness: 'interpretive' })).toBe(false);
    expect(isFatal({ ...fatal, groundedness: 'empirical' })).toBe(false);
  });

  it('does not fire on an aside or an unlocated finding', () => {
    expect(isFatal({ ...fatal, location: 'aside' })).toBe(false);
    expect(isFatal({ ...fatal, location: 'unknown' })).toBe(false);
  });

  it('v2: an emitted confidence must clear the floor; absence leaves the categorical bar standing', () => {
    expect(isFatal({ ...fatal, confidence: 0.92 })).toBe(true);
    expect(isFatal({ ...fatal, confidence: 0.84 })).toBe(false);
    expect(isFatal({ ...fatal, confidence: 0.5 })).toBe(false);
    expect(isFatal(fatal)).toBe(true); // no confidence emitted — v1 behaviour, never less conservative
  });

  it('fixture truth: fatalDemo carries exactly one fatal, the others none', () => {
    expect(fatalFindings(FIXTURES.fatalDemo)).toHaveLength(1);
    expect(fatalFindings(FIXTURES.briefingHit)).toHaveLength(0);
    expect(fatalFindings(FIXTURES.noPlacement)).toHaveLength(0);
  });
});
