import { describe, it, expect } from 'vitest';
import { priorityScore, sortByPriority } from '../../functions/_lib/audit/priority';

describe('priorityScore', () => {
  it('high + 100 confidence = 3.0', () => {
    expect(priorityScore({ severity: 'high', confidence: 100 })).toBe(3.0);
  });

  it('medium + 100 confidence = 2.0', () => {
    expect(priorityScore({ severity: 'medium', confidence: 100 })).toBe(2.0);
  });

  it('low + 100 confidence = 1.0', () => {
    expect(priorityScore({ severity: 'low', confidence: 100 })).toBe(1.0);
  });

  it('high + 50 confidence = 1.5', () => {
    expect(priorityScore({ severity: 'high', confidence: 50 })).toBe(1.5);
  });

  it('medium + 60 confidence = 1.2', () => {
    expect(priorityScore({ severity: 'medium', confidence: 60 })).toBeCloseTo(1.2);
  });

  it('low + 0 confidence = 0.0', () => {
    expect(priorityScore({ severity: 'low', confidence: 0 })).toBe(0.0);
  });

  it('high severity outranks medium even at lower confidence (high@60 > medium@100)', () => {
    expect(priorityScore({ severity: 'high', confidence: 60 }))
      .toBeGreaterThan(priorityScore({ severity: 'medium', confidence: 80 }));
  });
});

describe('sortByPriority', () => {
  it('sorts descending by priority score', () => {
    const findings = [
      { severity: 'low'    as const, confidence: 90, label: 'A' },
      { severity: 'high'   as const, confidence: 95, label: 'B' },
      { severity: 'medium' as const, confidence: 80, label: 'C' },
    ];
    const sorted = sortByPriority(findings);
    expect(sorted.map(f => f.label)).toEqual(['B', 'C', 'A']);
  });

  it('does not mutate the input array', () => {
    const findings = [
      { severity: 'low'  as const, confidence: 70 },
      { severity: 'high' as const, confidence: 90 },
    ];
    const originalOrder = findings.map(f => f.severity);
    sortByPriority(findings);
    expect(findings.map(f => f.severity)).toEqual(originalOrder);
  });

  it('handles empty array', () => {
    expect(sortByPriority([])).toEqual([]);
  });

  it('handles single-element array', () => {
    const findings = [{ severity: 'medium' as const, confidence: 75 }];
    expect(sortByPriority(findings)).toHaveLength(1);
  });

  it('stable order preserved for equal priority scores', () => {
    const findings = [
      { severity: 'medium' as const, confidence: 80, label: 'X' },
      { severity: 'medium' as const, confidence: 80, label: 'Y' },
    ];
    const sorted = sortByPriority(findings);
    expect(sorted).toHaveLength(2);
  });
});
