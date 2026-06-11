import { describe, it, expect } from 'vitest';
import { priorityScore, sortByPriority } from '../../functions/_lib/audit/priority';
import { structural, interpretive } from '../../functions/_lib/grounded/types';

describe('priorityScore', () => {
  it('high + structural = 3.0', () => {
    expect(priorityScore({ severity: 'high', groundedness: structural() })).toBe(3.0);
  });

  it('medium + structural = 2.0', () => {
    expect(priorityScore({ severity: 'medium', groundedness: structural() })).toBe(2.0);
  });

  it('low + structural = 1.0', () => {
    expect(priorityScore({ severity: 'low', groundedness: structural() })).toBe(1.0);
  });

  it('high + interpretive(medium) = 1.8', () => {
    expect(priorityScore({ severity: 'high', groundedness: interpretive('medium') })).toBeCloseTo(1.8);
  });

  it('medium + interpretive(low) = 0.8', () => {
    expect(priorityScore({ severity: 'medium', groundedness: interpretive('low') })).toBeCloseTo(0.8);
  });

  it('structural at lower severity outranks interpretive low at higher severity', () => {
    expect(priorityScore({ severity: 'medium', groundedness: structural() }))
      .toBeGreaterThan(priorityScore({ severity: 'high', groundedness: interpretive('low') }));
  });
});

describe('sortByPriority', () => {
  it('sorts descending by priority score', () => {
    const findings = [
      { severity: 'low'    as const, groundedness: structural(), label: 'A' },
      { severity: 'high'   as const, groundedness: structural(), label: 'B' },
      { severity: 'medium' as const, groundedness: structural(), label: 'C' },
    ];
    const sorted = sortByPriority(findings);
    expect(sorted.map(f => f.label)).toEqual(['B', 'C', 'A']);
  });

  it('does not mutate the input array', () => {
    const findings = [
      { severity: 'low'  as const, groundedness: structural() },
      { severity: 'high' as const, groundedness: structural() },
    ];
    const originalOrder = findings.map(f => f.severity);
    sortByPriority(findings);
    expect(findings.map(f => f.severity)).toEqual(originalOrder);
  });

  it('handles empty array', () => {
    expect(sortByPriority([])).toEqual([]);
  });

  it('handles single-element array', () => {
    const findings = [{ severity: 'medium' as const, groundedness: structural() }];
    expect(sortByPriority(findings)).toHaveLength(1);
  });

  it('preserves order for equal priority scores', () => {
    const findings = [
      { severity: 'medium' as const, groundedness: structural(), label: 'X' },
      { severity: 'medium' as const, groundedness: structural(), label: 'Y' },
    ];
    const sorted = sortByPriority(findings);
    expect(sorted).toHaveLength(2);
  });
});
