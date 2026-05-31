import { describe, it, expect } from 'vitest';
import {
  NamedFallacySchema,
  LoadedLanguageSchema,
  UnstatedWarrantSchema,
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
