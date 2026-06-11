import { describe, it, expect } from 'vitest';
import { diffAuditResults, diffCounterargResults } from '../../functions/_lib/documents/diff';
import type { NamedFallacy, LoadedLanguage } from '../../functions/_lib/audit/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const F_AD_HOMINEM: NamedFallacy = {
  name: 'Ad Hominem', quote: 'You cannot trust him because he is biased',
  explanation: 'Attacks the person, not the argument', severity: 'high', groundedness: { kind: "structural" } as const,
};
const F_AD_HOMINEM_DIFF_QUOTE: NamedFallacy = {
  ...F_AD_HOMINEM, quote: 'Different opening text — entirely distinct quote',
};
const F_STRAW_MAN: NamedFallacy = {
  name: 'Straw Man', quote: 'They claim we should ban all cars from the roads',
  explanation: 'Distorts opponent position', severity: 'medium', groundedness: { kind: "structural" } as const,
};

const LL_FREEDOM: LoadedLanguage = {
  phrase: 'freedom-loving', technique: 'Loaded framing',
  explanation: 'Implies opposition is anti-freedom', severity: 'low', groundedness: { kind: "structural" } as const,
};
const LL_JOB: LoadedLanguage = {
  phrase: 'job-killing', technique: 'Fear appeal',
  explanation: 'Implies job losses without evidence', severity: 'medium', groundedness: { kind: "structural" } as const,
};

function auditJson(opts: {
  centralClaim?: string;
  fallacies?: NamedFallacy[];
  loadedLanguage?: LoadedLanguage[];
} = {}) {
  return JSON.stringify({
    centralClaim:   opts.centralClaim  ?? 'The policy will help everyone',
    toulmin:        { claim: 'c', grounds: 'g', statedWarrant: null, unstatedWarrants: [], weakestLink: 'w' },
    namedFallacies: opts.fallacies      ?? [],
    loadedLanguage: opts.loadedLanguage ?? [],
    notes: null,
  });
}

function counterargJson(n = 2) {
  return JSON.stringify({
    centralClaim: 'Central claim',
    counterarguments: Array.from({ length: n }, (_, i) => ({
      position: `Position ${i + 1}`,
      strongestCase: { claim: 'c', grounds: 'g', warrant: 'w' },
      missedByDraft: 'm',
      why: 'y',
    })),
    notes: null,
  });
}

// ---------------------------------------------------------------------------
// diffAuditResults
// ---------------------------------------------------------------------------

describe('diffAuditResults', () => {
  it('both null → not audited, all arrays empty, summary zeros', () => {
    const d = diffAuditResults(null, null);
    expect(d.fromAudited).toBe(false);
    expect(d.toAudited).toBe(false);
    expect(d.fallacies.removed).toHaveLength(0);
    expect(d.fallacies.added).toHaveLength(0);
    expect(d.fallacies.persisted).toHaveLength(0);
    expect(d.loadedLanguage.removed).toHaveLength(0);
    expect(d.summary.fallaciesRemoved).toBe(0);
    expect(d.summary.centralClaimChanged).toBe(false);
  });

  it('from null, to audited → toAudited=true, all fallacies appear as added', () => {
    const d = diffAuditResults(null, auditJson({ fallacies: [F_AD_HOMINEM, F_STRAW_MAN] }));
    expect(d.fromAudited).toBe(false);
    expect(d.toAudited).toBe(true);
    expect(d.fallacies.added).toHaveLength(2);
    expect(d.fallacies.removed).toHaveLength(0);
    expect(d.fallacies.persisted).toHaveLength(0);
    expect(d.summary.fallaciesAdded).toBe(2);
  });

  it('same fallacy in both → persisted, not removed or added', () => {
    const d = diffAuditResults(
      auditJson({ fallacies: [F_AD_HOMINEM] }),
      auditJson({ fallacies: [F_AD_HOMINEM] }),
    );
    expect(d.fallacies.persisted).toHaveLength(1);
    expect(d.fallacies.removed).toHaveLength(0);
    expect(d.fallacies.added).toHaveLength(0);
    expect(d.summary.fallaciesPersisted).toBe(1);
  });

  it('same name but different quote → one removed, one added, nothing persisted', () => {
    const d = diffAuditResults(
      auditJson({ fallacies: [F_AD_HOMINEM] }),
      auditJson({ fallacies: [F_AD_HOMINEM_DIFF_QUOTE] }),
    );
    expect(d.fallacies.removed).toHaveLength(1);
    expect(d.fallacies.added).toHaveLength(1);
    expect(d.fallacies.persisted).toHaveLength(0);
    expect(d.summary.fallaciesRemoved).toBe(1);
    expect(d.summary.fallaciesAdded).toBe(1);
  });

  it('from has fallacy, to has none → one removed', () => {
    const d = diffAuditResults(
      auditJson({ fallacies: [F_AD_HOMINEM] }),
      auditJson({ fallacies: [] }),
    );
    expect(d.fallacies.removed).toHaveLength(1);
    expect(d.fallacies.added).toHaveLength(0);
    expect(d.fallacies.persisted).toHaveLength(0);
    expect(d.summary.fallaciesRemoved).toBe(1);
  });

  it('loaded language matched by phrase+technique — new phrase is added', () => {
    const d = diffAuditResults(
      auditJson({ loadedLanguage: [LL_FREEDOM] }),
      auditJson({ loadedLanguage: [LL_FREEDOM, LL_JOB] }),
    );
    expect(d.loadedLanguage.persisted).toHaveLength(1);
    expect(d.loadedLanguage.added).toHaveLength(1);
    expect(d.loadedLanguage.removed).toHaveLength(0);
    expect(d.summary.loadedAdded).toBe(1);
  });

  it('central claim changed → centralClaim.changed=true, summary reflects it', () => {
    const d = diffAuditResults(
      auditJson({ centralClaim: 'Claim A' }),
      auditJson({ centralClaim: 'Claim B' }),
    );
    expect(d.centralClaim.changed).toBe(true);
    expect(d.centralClaim.from).toBe('Claim A');
    expect(d.centralClaim.to).toBe('Claim B');
    expect(d.summary.centralClaimChanged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// diffCounterargResults
// ---------------------------------------------------------------------------

describe('diffCounterargResults', () => {
  it('both null → fromGenerated=false, toGenerated=false, empty arrays', () => {
    const d = diffCounterargResults(null, null);
    expect(d.fromGenerated).toBe(false);
    expect(d.toGenerated).toBe(false);
    expect(d.counterarguments.from).toHaveLength(0);
    expect(d.counterarguments.to).toHaveLength(0);
  });

  it('from generated, to null → fromGenerated=true, toGenerated=false', () => {
    const d = diffCounterargResults(counterargJson(2), null);
    expect(d.fromGenerated).toBe(true);
    expect(d.toGenerated).toBe(false);
    expect(d.counterarguments.from).toHaveLength(2);
    expect(d.counterarguments.to).toHaveLength(0);
  });

  it('both generated → both flags true, arrays populated', () => {
    const d = diffCounterargResults(counterargJson(2), counterargJson(3));
    expect(d.fromGenerated).toBe(true);
    expect(d.toGenerated).toBe(true);
    expect(d.counterarguments.from).toHaveLength(2);
    expect(d.counterarguments.to).toHaveLength(3);
  });
});
