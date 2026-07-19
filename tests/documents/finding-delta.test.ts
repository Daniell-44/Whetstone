import { describe, it, expect } from 'vitest';
import { auditFindingKeys, computeFindingDelta, computeFindingDeltaFromJson } from '../../functions/_lib/documents/finding-delta';
import type { AuditResult, NamedFallacy, LoadedLanguage } from '../../functions/_lib/audit/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUNDED = { kind: 'structural' } as const;

function fallacy(name: string, quote: string): NamedFallacy {
  return { name, quote, explanation: 'e', severity: 'medium', groundedness: GROUNDED };
}

function loaded(phrase: string, technique: string): LoadedLanguage {
  return { phrase, technique, explanation: 'e', severity: 'low', groundedness: GROUNDED };
}

function audit(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    centralClaim:         'The policy will help everyone',
    toulmin:              { claim: 'c', grounds: 'g', statedWarrant: null, unstatedWarrants: [], weakestLink: 'w' },
    namedFallacies:       [],
    loadedLanguage:       [],
    notes:                null,
    keyTermScrutiny:      [],
    referentChecks:       [],
    falsifiabilityChecks: [],
    modalScopeChecks:     [],
    ...overrides,
  };
}

const F_AD_HOM   = fallacy('Ad Hominem', 'You cannot trust him because he is biased');
const F_STRAW    = fallacy('Straw Man', 'They claim we should ban all cars entirely');
const LL_KILLING = loaded('job-killing', 'Fear appeal');

// ---------------------------------------------------------------------------
// auditFindingKeys
// ---------------------------------------------------------------------------

describe('auditFindingKeys', () => {
  it('collects keys from every finding lens', () => {
    const keys = auditFindingKeys(audit({
      namedFallacies: [F_AD_HOM],
      loadedLanguage: [LL_KILLING],
      toulmin: { claim: 'c', grounds: 'g', statedWarrant: null, weakestLink: 'w',
        unstatedWarrants: [{ warrant: 'Markets always self-correct', necessity: 'n', severity: 'high', groundedness: GROUNDED }] },
      keyTermScrutiny:      [{ term: 'freedom', usage_a: 'a', usage_b: 'b', issue: 'stipulative-smuggling', explanation: 'e', severity: 'medium', groundedness: GROUNDED }],
      referentChecks:       [{ phrase: 'the elites', issue: 'vague-proper-name', explanation: 'e', evidence: 'ev', severity: 'low', groundedness: GROUNDED }],
      falsifiabilityChecks: [{ claim: 'History proves this', issue: 'no-truth-conditions', explanation: 'e', evidence: 'ev', severity: 'medium', groundedness: GROUNDED }],
      modalScopeChecks:     [{ claim: 'This will collapse', inflatedModal: 'will', impliedModal: 'may', issue: 'necessity-overstated', explanation: 'e', evidence: 'ev', severity: 'high', groundedness: GROUNDED }],
    }));
    expect(keys.size).toBe(7);
  });

  it('tolerates missing phase-2 arrays (older stored audits)', () => {
    const legacy = {
      centralClaim:   'c',
      toulmin:        { claim: 'c', grounds: 'g', statedWarrant: null, unstatedWarrants: [], weakestLink: 'w' },
      namedFallacies: [F_AD_HOM],
      loadedLanguage: [],
      notes:          null,
    } as unknown as AuditResult;
    expect(auditFindingKeys(legacy).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeFindingDelta
// ---------------------------------------------------------------------------

describe('computeFindingDelta', () => {
  it('reports everything as new on a first audit (no previous)', () => {
    const delta = computeFindingDelta(null, audit({ namedFallacies: [F_AD_HOM, F_STRAW] }));
    expect(delta).toEqual({ newFindings: 2, resolved: 0 });
  });

  it('reports zero delta when the same findings persist', () => {
    const prev = audit({ namedFallacies: [F_AD_HOM], loadedLanguage: [LL_KILLING] });
    const next = audit({ namedFallacies: [F_AD_HOM], loadedLanguage: [LL_KILLING] });
    expect(computeFindingDelta(prev, next)).toEqual({ newFindings: 0, resolved: 0 });
  });

  it('counts resolved findings that disappear and new ones that appear', () => {
    const prev = audit({ namedFallacies: [F_AD_HOM], loadedLanguage: [LL_KILLING] });
    const next = audit({ namedFallacies: [F_STRAW] });
    // F_AD_HOM and LL_KILLING resolved; F_STRAW new
    expect(computeFindingDelta(prev, next)).toEqual({ newFindings: 1, resolved: 2 });
  });

  it('matches on quote + kind: same fallacy name with a different quote is a new finding', () => {
    const prev = audit({ namedFallacies: [F_AD_HOM] });
    const next = audit({ namedFallacies: [fallacy('Ad Hominem', 'A completely different quoted sentence here')] });
    expect(computeFindingDelta(prev, next)).toEqual({ newFindings: 1, resolved: 1 });
  });

  it('treats minor punctuation and whitespace changes in the quote as the same finding', () => {
    const prev = audit({ namedFallacies: [fallacy('Straw Man', 'They claim,  we should ban ALL cars entirely')] });
    const next = audit({ namedFallacies: [F_STRAW] });
    expect(computeFindingDelta(prev, next)).toEqual({ newFindings: 0, resolved: 0 });
  });

  it('a warrant resolved in a later toulmin analysis counts as resolved', () => {
    const w = { warrant: 'Growth is always good', necessity: 'n', severity: 'medium' as const, groundedness: GROUNDED };
    const prev = audit({ toulmin: { claim: 'c', grounds: 'g', statedWarrant: null, unstatedWarrants: [w], weakestLink: 'w' } });
    const next = audit();
    expect(computeFindingDelta(prev, next)).toEqual({ newFindings: 0, resolved: 1 });
  });
});

// ---------------------------------------------------------------------------
// computeFindingDeltaFromJson
// ---------------------------------------------------------------------------

describe('computeFindingDeltaFromJson', () => {
  it('parses raw db columns and handles a null previous audit', () => {
    const nextJson = JSON.stringify(audit({ namedFallacies: [F_AD_HOM] }));
    expect(computeFindingDeltaFromJson(null, nextJson)).toEqual({ newFindings: 1, resolved: 0 });

    const prevJson = JSON.stringify(audit({ namedFallacies: [F_AD_HOM, F_STRAW] }));
    expect(computeFindingDeltaFromJson(prevJson, nextJson)).toEqual({ newFindings: 0, resolved: 1 });
  });
});
