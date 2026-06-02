import { describe, it, expect } from 'vitest';
import {
  LABELS_PLAIN,
  LABELS_FORMAL,
  TOOLTIPS_PLAIN,
  TOOLTIPS_FORMAL,
  LABELS,
  TOOLTIPS,
  getLabels,
  getTooltips,
} from '../../src/lib/labels';

// ---------------------------------------------------------------------------
// Label dictionaries
// ---------------------------------------------------------------------------

describe('LABELS_PLAIN', () => {
  it('has 30 keys', () => {
    expect(Object.keys(LABELS_PLAIN)).toHaveLength(30);
  });

  it('every value is a non-empty string', () => {
    for (const [key, val] of Object.entries(LABELS_PLAIN)) {
      expect(typeof val, key).toBe('string');
      expect(val.length, key).toBeGreaterThan(0);
    }
  });
});

describe('LABELS_FORMAL', () => {
  it('has the same 29 keys as LABELS_PLAIN', () => {
    const plainKeys  = Object.keys(LABELS_PLAIN).sort();
    const formalKeys = Object.keys(LABELS_FORMAL).sort();
    expect(formalKeys).toEqual(plainKeys);
  });

  it('every value is a non-empty string', () => {
    for (const [key, val] of Object.entries(LABELS_FORMAL)) {
      expect(typeof val, key).toBe('string');
      expect(val.length, key).toBeGreaterThan(0);
    }
  });

  it('uses technical terminology for key labels', () => {
    expect(LABELS_FORMAL.unstatedWarrants).toBe('Unstated Warrants');
    expect(LABELS_FORMAL.commitments).toBe('Philosophical Commitments');
    expect(LABELS_FORMAL.keyTermScrutiny).toBe('Wittgensteinian Key-Term Scrutiny');
    expect(LABELS_FORMAL.referentChecks).toBe('Russellian Referent Check');
  });

  it('differs from plain for most keys', () => {
    const diffCount = Object.keys(LABELS_PLAIN).filter(
      k => LABELS_PLAIN[k as keyof typeof LABELS_PLAIN] !== LABELS_FORMAL[k as keyof typeof LABELS_FORMAL],
    ).length;
    expect(diffCount).toBeGreaterThan(15);
  });
});

// ---------------------------------------------------------------------------
// Tooltip dictionaries
// ---------------------------------------------------------------------------

describe('TOOLTIPS_PLAIN', () => {
  it('has an entry for every LABELS_PLAIN key', () => {
    for (const key of Object.keys(LABELS_PLAIN)) {
      expect(TOOLTIPS_PLAIN, key).toHaveProperty(key);
    }
  });

  it('every entry has non-empty plain and pedigree strings', () => {
    for (const [key, entry] of Object.entries(TOOLTIPS_PLAIN)) {
      expect(typeof entry.plain,    key).toBe('string');
      expect(entry.plain.length,    key).toBeGreaterThan(0);
      expect(typeof entry.pedigree, key).toBe('string');
      expect(entry.pedigree.length, key).toBeGreaterThan(0);
    }
  });
});

describe('TOOLTIPS_FORMAL', () => {
  it('has an entry for every LABELS_PLAIN key', () => {
    for (const key of Object.keys(LABELS_PLAIN)) {
      expect(TOOLTIPS_FORMAL, key).toHaveProperty(key);
    }
  });

  it('every entry has non-empty plain and pedigree strings', () => {
    for (const [key, entry] of Object.entries(TOOLTIPS_FORMAL)) {
      expect(typeof entry.plain,    key).toBe('string');
      expect(entry.plain.length,    key).toBeGreaterThan(0);
      expect(typeof entry.pedigree, key).toBe('string');
      expect(entry.pedigree.length, key).toBeGreaterThan(0);
    }
  });

  it('formal tooltips are generally longer than plain (denser pedigree)', () => {
    const formalPedigreeTotal = Object.values(TOOLTIPS_FORMAL).reduce((n, t) => n + t.pedigree.length, 0);
    const plainPedigreeTotal  = Object.values(TOOLTIPS_PLAIN).reduce((n, t)  => n + t.pedigree.length, 0);
    expect(formalPedigreeTotal).toBeGreaterThan(plainPedigreeTotal);
  });
});

// ---------------------------------------------------------------------------
// Backward-compat re-exports
// ---------------------------------------------------------------------------

describe('backward-compat re-exports', () => {
  it('LABELS is the same object reference as LABELS_PLAIN', () => {
    expect(LABELS).toBe(LABELS_PLAIN);
  });

  it('TOOLTIPS is the same object reference as TOOLTIPS_PLAIN', () => {
    expect(TOOLTIPS).toBe(TOOLTIPS_PLAIN);
  });
});

// ---------------------------------------------------------------------------
// getLabels helper
// ---------------------------------------------------------------------------

describe('getLabels', () => {
  it('returns LABELS_PLAIN when preference is undefined', () => {
    expect(getLabels()).toBe(LABELS_PLAIN);
  });

  it('returns LABELS_PLAIN when preference is "plain"', () => {
    expect(getLabels('plain')).toBe(LABELS_PLAIN);
  });

  it('returns LABELS_FORMAL when preference is "formal"', () => {
    expect(getLabels('formal')).toBe(LABELS_FORMAL);
  });

  it('plain labels differ from formal for unstatedWarrants', () => {
    expect(getLabels('plain').unstatedWarrants).toBe('Hidden Assumptions');
    expect(getLabels('formal').unstatedWarrants).toBe('Unstated Warrants');
  });
});

// ---------------------------------------------------------------------------
// getTooltips helper
// ---------------------------------------------------------------------------

describe('getTooltips', () => {
  it('returns TOOLTIPS_PLAIN when preference is undefined', () => {
    expect(getTooltips()).toBe(TOOLTIPS_PLAIN);
  });

  it('returns TOOLTIPS_PLAIN when preference is "plain"', () => {
    expect(getTooltips('plain')).toBe(TOOLTIPS_PLAIN);
  });

  it('returns TOOLTIPS_FORMAL when preference is "formal"', () => {
    expect(getTooltips('formal')).toBe(TOOLTIPS_FORMAL);
  });

  it('formal tooltip for toulminWarrant mentions "suppressed major premise"', () => {
    const t = getTooltips('formal').toulminWarrant;
    expect(t.plain.toLowerCase()).toContain('suppress');
  });
});
