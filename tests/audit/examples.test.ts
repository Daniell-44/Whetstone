import { describe, it, expect } from 'vitest';
import { FALLACY_NAMES } from '../../functions/_lib/audit/taxonomy';
import { FALLACY_EXAMPLES } from '../../functions/_lib/audit/examples';

describe('FALLACY_EXAMPLES', () => {
  it('has exactly one entry per fallacy name (no missing, no extras)', () => {
    const exampleKeys = Object.keys(FALLACY_EXAMPLES).sort();
    const names = [...FALLACY_NAMES].sort();
    expect(exampleKeys).toEqual(names);
  });

  it('every entry has a non-empty example, why, and an https reference', () => {
    for (const [name, ex] of Object.entries(FALLACY_EXAMPLES)) {
      expect(ex.example.trim(), `${name}.example`).not.toBe('');
      expect(ex.why.trim(), `${name}.why`).not.toBe('');
      expect(ex.reference, `${name}.reference`).toMatch(/^https:\/\/\S+$/);
    }
  });
});
