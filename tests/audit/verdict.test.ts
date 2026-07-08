import { describe, it, expect } from 'vitest';
import { auditVerdict, groundednessBreakdown, lensesChecked } from '../../functions/_lib/audit/stats';
import { structural, interpretive, empirical } from '../../functions/_lib/grounded/types';
import type { GroundednessSignal } from '../../functions/_lib/grounded/types';
import type { AuditResult } from '../../functions/_lib/audit/types';

// Minimal finding — the stats helpers only read `severity` + `groundedness`.
function f(severity: 'high' | 'medium' | 'low', g: GroundednessSignal) {
  return { severity, groundedness: g } as unknown as AuditResult['namedFallacies'][number];
}

function audit(parts: Partial<AuditResult> & { warrants?: AuditResult['toulmin']['unstatedWarrants'] }): AuditResult {
  const { warrants, ...rest } = parts;
  return {
    centralClaim: 'c',
    toulmin: { claim: '', grounds: '', statedWarrant: null, unstatedWarrants: warrants ?? [], weakestLink: '' },
    namedFallacies: [],
    loadedLanguage: [],
    notes: null,
    keyTermScrutiny: [],
    referentChecks: [],
    falsifiabilityChecks: [],
    modalScopeChecks: [],
    ...rest,
  } as AuditResult;
}

describe('groundednessBreakdown', () => {
  it('counts each kind across all lenses', () => {
    const a = audit({
      namedFallacies: [f('high', structural()), f('low', structural())],
      loadedLanguage: [f('medium', interpretive('medium'))],
      referentChecks: [f('low', empirical(0, 0, null))],
    });
    expect(groundednessBreakdown(a)).toEqual({ structural: 2, interpretive: 1, empirical: 1 });
  });
});

describe('auditVerdict', () => {
  it('reads clean when there are no findings', () => {
    expect(auditVerdict(audit({}))).toMatch(/^Clean bill/);
  });

  it('flags a logic-dominated audit', () => {
    const a = audit({ namedFallacies: [f('high', structural()), f('high', structural()), f('high', structural()), f('low', interpretive('low'))] });
    expect(auditVerdict(a)).toMatch(/Mostly matters of logic/);
  });

  it('flags a judgment-dominated audit', () => {
    const a = audit({ loadedLanguage: [f('high', interpretive('high')), f('medium', interpretive('medium')), f('low', interpretive('low')), f('low', structural())] });
    expect(auditVerdict(a)).toMatch(/Mostly judgment calls/);
  });

  it('calls an even split a mix', () => {
    const a = audit({ namedFallacies: [f('high', structural()), f('high', structural())], loadedLanguage: [f('low', interpretive('low')), f('low', interpretive('low'))] });
    expect(auditVerdict(a)).toMatch(/A mix of logic and judgment calls/);
  });

  it('appends the empirical caveat when a factual finding is present', () => {
    const a = audit({ namedFallacies: [f('high', structural()), f('high', structural()), f('high', structural())], referentChecks: [f('low', empirical(1, 0, null))] });
    expect(auditVerdict(a)).toMatch(/Some hinge on facts outside the text/);
  });
});

describe('lensesChecked', () => {
  it('always lists the three base lenses with their counts (including zero)', () => {
    const checked = lensesChecked(audit({ namedFallacies: [f('high', structural())] }));
    const base = checked.filter(l => l.base);
    expect(base.map(l => l.key)).toEqual(['namedFallacies', 'loadedLanguage', 'unstatedWarrants']);
    expect(base.find(l => l.key === 'namedFallacies')!.count).toBe(1);
    expect(base.find(l => l.key === 'loadedLanguage')!.count).toBe(0);
  });

  it('lists a phase-2 lens only when it produced a finding', () => {
    const withoutP2 = lensesChecked(audit({ namedFallacies: [f('high', structural())] }));
    expect(withoutP2.some(l => l.key === 'referentChecks')).toBe(false);

    const withP2 = lensesChecked(audit({ referentChecks: [f('medium', structural())] }));
    const ref = withP2.find(l => l.key === 'referentChecks');
    expect(ref).toBeDefined();
    expect(ref!.count).toBe(1);
    expect(ref!.base).toBe(false);
  });
});
