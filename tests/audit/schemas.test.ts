import { describe, it, expect } from 'vitest';
import {
  // Raw* schemas validate raw model output — these still carry `confidence`.
  RawNamedFallacySchema as NamedFallacySchema,
  RawLoadedLanguageSchema as LoadedLanguageSchema,
  RawUnstatedWarrantSchema as UnstatedWarrantSchema,
  RawKeyTermScrutinyFindingSchema as KeyTermScrutinyFindingSchema,
  RawReferentCheckFindingSchema as ReferentCheckFindingSchema,
  RawFalsifiabilityFindingSchema as FalsifiabilityFindingSchema,
  RawAuditResultSchema as AuditResultSchema,
  // Canonical schemas are what the API returns — these carry `groundedness`.
  NamedFallacySchema as GroundedNamedFallacySchema,
  AuditResultSchema as GroundedAuditResultSchema,
} from '../../functions/_lib/audit/schemas';

// ---------------------------------------------------------------------------
// NamedFallacySchema
// ---------------------------------------------------------------------------

describe('NamedFallacySchema — confidence validation', () => {
  const base = { name: 'Ad Hominem', quote: 'x', explanation: 'y', severity: 'low' };

  it('accepts confidence = 0', () => {
    expect(NamedFallacySchema.safeParse({ ...base, confidence: 0 }).success).toBe(true);
  });

  it('accepts confidence = 100', () => {
    expect(NamedFallacySchema.safeParse({ ...base, confidence: 100 }).success).toBe(true);
  });

  it('rejects confidence = -1', () => {
    expect(NamedFallacySchema.safeParse({ ...base, confidence: -1 }).success).toBe(false);
  });

  it('rejects confidence = 101', () => {
    expect(NamedFallacySchema.safeParse({ ...base, confidence: 101 }).success).toBe(false);
  });

  it('rejects non-integer confidence', () => {
    expect(NamedFallacySchema.safeParse({ ...base, confidence: 75.5 }).success).toBe(false);
  });

  it('rejects missing confidence', () => {
    expect(NamedFallacySchema.safeParse(base).success).toBe(false);
  });
});

describe('NamedFallacySchema — severity validation', () => {
  const base = { name: 'Ad Hominem', quote: 'x', explanation: 'y', confidence: 80 };

  it('accepts "high"', () => {
    expect(NamedFallacySchema.safeParse({ ...base, severity: 'high' }).success).toBe(true);
  });

  it('accepts "medium"', () => {
    expect(NamedFallacySchema.safeParse({ ...base, severity: 'medium' }).success).toBe(true);
  });

  it('accepts "low"', () => {
    expect(NamedFallacySchema.safeParse({ ...base, severity: 'low' }).success).toBe(true);
  });

  it('rejects invalid severity string', () => {
    expect(NamedFallacySchema.safeParse({ ...base, severity: 'critical' }).success).toBe(false);
  });

  it('rejects missing severity', () => {
    expect(NamedFallacySchema.safeParse(base).success).toBe(false);
  });
});

describe('NamedFallacySchema — new taxonomy names accepted', () => {
  const rest = { quote: 'x', explanation: 'y', severity: 'medium', confidence: 72 };

  it('accepts "Texas Sharpshooter"', () => {
    expect(NamedFallacySchema.safeParse({ ...rest, name: 'Texas Sharpshooter' }).success).toBe(true);
  });

  it('accepts "No True Scotsman"', () => {
    expect(NamedFallacySchema.safeParse({ ...rest, name: 'No True Scotsman' }).success).toBe(true);
  });

  it('accepts "Cherry-Picking"', () => {
    expect(NamedFallacySchema.safeParse({ ...rest, name: 'Cherry-Picking' }).success).toBe(true);
  });

  it('accepts "Abductive Closure"', () => {
    expect(NamedFallacySchema.safeParse({ ...rest, name: 'Abductive Closure' }).success).toBe(true);
  });

  it('accepts "Gish Gallop"', () => {
    expect(NamedFallacySchema.safeParse({ ...rest, name: 'Gish Gallop' }).success).toBe(true);
  });

  it('rejects an unknown name', () => {
    expect(NamedFallacySchema.safeParse({ ...rest, name: 'Galaxy-Brained Reasoning' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LoadedLanguageSchema
// ---------------------------------------------------------------------------

describe('LoadedLanguageSchema — confidence + severity required', () => {
  const base = { phrase: 'x', technique: 'Weasel words', explanation: 'y' };

  it('rejects missing confidence', () => {
    expect(LoadedLanguageSchema.safeParse({ ...base, severity: 'low' }).success).toBe(false);
  });

  it('rejects missing severity', () => {
    expect(LoadedLanguageSchema.safeParse({ ...base, confidence: 70 }).success).toBe(false);
  });

  it('rejects out-of-range confidence', () => {
    expect(LoadedLanguageSchema.safeParse({ ...base, severity: 'low', confidence: 105 }).success).toBe(false);
  });

  it('accepts valid finding', () => {
    expect(LoadedLanguageSchema.safeParse({ ...base, severity: 'low', confidence: 70 }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UnstatedWarrantSchema
// ---------------------------------------------------------------------------

describe('UnstatedWarrantSchema — confidence + severity required', () => {
  const base = { warrant: 'x', necessity: 'y' };

  it('rejects missing confidence', () => {
    expect(UnstatedWarrantSchema.safeParse({ ...base, severity: 'medium' }).success).toBe(false);
  });

  it('rejects missing severity', () => {
    expect(UnstatedWarrantSchema.safeParse({ ...base, confidence: 75 }).success).toBe(false);
  });

  it('rejects confidence above 100', () => {
    expect(UnstatedWarrantSchema.safeParse({ ...base, severity: 'high', confidence: 150 }).success).toBe(false);
  });

  it('rejects non-integer confidence', () => {
    expect(UnstatedWarrantSchema.safeParse({ ...base, severity: 'high', confidence: 80.5 }).success).toBe(false);
  });

  it('accepts valid finding', () => {
    expect(UnstatedWarrantSchema.safeParse({ ...base, severity: 'high', confidence: 88 }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KeyTermScrutinyFindingSchema
// ---------------------------------------------------------------------------

describe('KeyTermScrutinyFindingSchema', () => {
  const base = {
    term:        'freedom',
    usage_a:     'freedom from government interference',
    usage_b:     'freedom to pursue your potential',
    issue:       'cross-language-game-equivocation',
    explanation: 'The term shifts meaning between the two uses.',
    severity:    'high',
    confidence:  82,
  };

  it('accepts a valid finding', () => {
    expect(KeyTermScrutinyFindingSchema.safeParse(base).success).toBe(true);
  });

  it('accepts all valid issue values', () => {
    const issues = ['stipulative-smuggling', 'cross-language-game-equivocation', 'family-resemblance-overreach'];
    for (const issue of issues) {
      expect(KeyTermScrutinyFindingSchema.safeParse({ ...base, issue }).success).toBe(true);
    }
  });

  it('rejects an unknown issue value', () => {
    expect(KeyTermScrutinyFindingSchema.safeParse({ ...base, issue: 'weasel-wording' }).success).toBe(false);
  });

  it('rejects missing usage_a', () => {
    const { usage_a, ...rest } = base;
    expect(KeyTermScrutinyFindingSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing usage_b', () => {
    const { usage_b, ...rest } = base;
    expect(KeyTermScrutinyFindingSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects out-of-range confidence', () => {
    expect(KeyTermScrutinyFindingSchema.safeParse({ ...base, confidence: 101 }).success).toBe(false);
  });

  it('rejects invalid severity', () => {
    expect(KeyTermScrutinyFindingSchema.safeParse({ ...base, severity: 'critical' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ReferentCheckFindingSchema
// ---------------------------------------------------------------------------

describe('ReferentCheckFindingSchema', () => {
  const base = {
    phrase:      'real Americans',
    issue:       'empty-referent',
    explanation: 'No determinate set of people is picked out.',
    evidence:    'Real Americans believe in hard work.',
    severity:    'medium',
    confidence:  75,
  };

  it('accepts a valid finding', () => {
    expect(ReferentCheckFindingSchema.safeParse(base).success).toBe(true);
  });

  it('accepts all valid issue values', () => {
    const issues = ['empty-referent', 'vague-proper-name', 'failed-presupposition'];
    for (const issue of issues) {
      expect(ReferentCheckFindingSchema.safeParse({ ...base, issue }).success).toBe(true);
    }
  });

  it('rejects unknown issue value', () => {
    expect(ReferentCheckFindingSchema.safeParse({ ...base, issue: 'bad-reference' }).success).toBe(false);
  });

  it('rejects missing evidence', () => {
    const { evidence, ...rest } = base;
    expect(ReferentCheckFindingSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty evidence string', () => {
    expect(ReferentCheckFindingSchema.safeParse({ ...base, evidence: '' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FalsifiabilityFindingSchema
// ---------------------------------------------------------------------------

describe('FalsifiabilityFindingSchema', () => {
  const base = {
    claim:       'True leadership always makes the right call.',
    issue:       'circular-truth-conditions',
    explanation: '"True leadership" is defined as making right calls — the claim is tautological.',
    evidence:    'True leadership means making the right decisions.',
    severity:    'high',
    confidence:  88,
  };

  it('accepts a valid finding', () => {
    expect(FalsifiabilityFindingSchema.safeParse(base).success).toBe(true);
  });

  it('accepts all valid issue values', () => {
    const issues = ['no-truth-conditions', 'circular-truth-conditions', 'unfalsifiable-dressed-as-substantive'];
    for (const issue of issues) {
      expect(FalsifiabilityFindingSchema.safeParse({ ...base, issue }).success).toBe(true);
    }
  });

  it('rejects unknown issue value', () => {
    expect(FalsifiabilityFindingSchema.safeParse({ ...base, issue: 'empirically-weak' }).success).toBe(false);
  });

  it('rejects missing claim', () => {
    const { claim, ...rest } = base;
    expect(FalsifiabilityFindingSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing evidence', () => {
    const { evidence, ...rest } = base;
    expect(FalsifiabilityFindingSchema.safeParse(rest).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AuditResultSchema — Phase-2 arrays default to []
// ---------------------------------------------------------------------------

describe('AuditResultSchema — Phase-2 fields default to empty arrays', () => {
  const baseResult = {
    centralClaim:   'Test.',
    toulmin: {
      claim:            'Test.',
      grounds:          'Test.',
      statedWarrant:    null,
      unstatedWarrants: [],
      weakestLink:      'Test.',
    },
    namedFallacies: [],
    loadedLanguage: [],
    notes:          null,
  };

  it('parses when Phase-2 fields are absent (anonymous audit)', () => {
    const result = AuditResultSchema.safeParse(baseResult);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keyTermScrutiny).toEqual([]);
      expect(result.data.referentChecks).toEqual([]);
      expect(result.data.falsifiabilityChecks).toEqual([]);
    }
  });

  it('parses when Phase-2 fields are explicitly empty', () => {
    const result = AuditResultSchema.safeParse({
      ...baseResult,
      keyTermScrutiny:      [],
      referentChecks:       [],
      falsifiabilityChecks: [],
    });
    expect(result.success).toBe(true);
  });

  it('parses when Phase-2 fields contain valid findings', () => {
    const result = AuditResultSchema.safeParse({
      ...baseResult,
      keyTermScrutiny: [{
        term:        'freedom',
        usage_a:     'freedom from interference',
        usage_b:     'freedom to flourish',
        issue:       'cross-language-game-equivocation',
        explanation: 'The term shifts.',
        severity:    'high',
        confidence:  80,
      }],
      referentChecks: [],
      falsifiabilityChecks: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid Phase-2 finding shape', () => {
    const result = AuditResultSchema.safeParse({
      ...baseResult,
      keyTermScrutiny: [{ term: 'freedom', issue: 'bad-issue' }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Canonical (grounded) schemas — what the API returns. Findings carry a
// `groundedness` signal instead of a numeric confidence.
// ---------------------------------------------------------------------------

describe('NamedFallacySchema (canonical) — groundedness', () => {
  const base = { name: 'Ad Hominem', quote: 'x', explanation: 'y', severity: 'low' };

  it('accepts a structural signal', () => {
    expect(GroundedNamedFallacySchema.safeParse({ ...base, groundedness: { kind: 'structural' } }).success).toBe(true);
  });

  it('accepts an interpretive signal with a band', () => {
    expect(GroundedNamedFallacySchema.safeParse({ ...base, groundedness: { kind: 'interpretive', band: 'high' } }).success).toBe(true);
  });

  it('rejects a missing groundedness signal', () => {
    expect(GroundedNamedFallacySchema.safeParse(base).success).toBe(false);
  });

  it('rejects a numeric confidence in place of groundedness', () => {
    expect(GroundedNamedFallacySchema.safeParse({ ...base, confidence: 80 }).success).toBe(false);
  });
});

describe('AuditResultSchema (canonical) — grounded findings', () => {
  const baseResult = {
    centralClaim: 'Test.',
    toulmin: { claim: 'Test.', grounds: 'Test.', statedWarrant: null, unstatedWarrants: [], weakestLink: 'Test.' },
    namedFallacies: [],
    loadedLanguage: [],
    notes: null,
  };

  it('parses a result with a grounded finding', () => {
    const result = GroundedAuditResultSchema.safeParse({
      ...baseResult,
      namedFallacies: [
        { name: 'Ad Hominem', quote: 'x', explanation: 'y', severity: 'low', groundedness: { kind: 'structural' } },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a finding that still uses confidence', () => {
    const result = GroundedAuditResultSchema.safeParse({
      ...baseResult,
      namedFallacies: [
        { name: 'Ad Hominem', quote: 'x', explanation: 'y', severity: 'low', confidence: 80 },
      ],
    });
    expect(result.success).toBe(false);
  });
});
