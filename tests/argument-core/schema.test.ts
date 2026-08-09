import { describe, it, expect } from 'vitest';
import { ArgumentMapSchema, stanceLabel } from '../../src/lib/argument-core/schema';
import { FIXTURES, briefingHit } from '../../src/lib/argument-core/fixtures';

describe('argument-core schema', () => {
  it('every P0 fixture parses against the contract', () => {
    for (const [name, map] of Object.entries(FIXTURES)) {
      const result = ArgumentMapSchema.safeParse(map);
      expect(result.success, `fixture "${name}" must satisfy ArgumentMapSchema`).toBe(true);
    }
  });

  it('rejects a stance outside the signed 5-band ordinal', () => {
    const bad = structuredClone(briefingHit) as Record<string, unknown>;
    (bad.placement as Record<string, unknown>).stance = 3;
    expect(ArgumentMapSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a placement without its basis quote — every stance call shows its work', () => {
    const bad = structuredClone(briefingHit) as Record<string, unknown>;
    delete (bad.placement as Record<string, unknown>).basisQuote;
    expect(ArgumentMapSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an empty claims array — a skeleton without a conclusion is not a skeleton', () => {
    const bad = structuredClone(briefingHit) as Record<string, unknown>;
    (bad.skeleton as Record<string, unknown>).claims = [];
    expect(ArgumentMapSchema.safeParse(bad).success).toBe(false);
  });

  it('placement may be null (the honest no-map state), never absent', () => {
    expect(ArgumentMapSchema.safeParse(FIXTURES.noPlacement).success).toBe(true);
    const bad = structuredClone(FIXTURES.noPlacement) as Record<string, unknown>;
    delete bad.placement;
    expect(ArgumentMapSchema.safeParse(bad).success).toBe(false);
  });

  it('stanceLabel always names the pole in text (colourblind law)', () => {
    expect(stanceLabel(-2, 'left pole', 'right pole')).toContain('left pole');
    expect(stanceLabel(2, 'left pole', 'right pole')).toContain('right pole');
    expect(stanceLabel(0, 'left pole', 'right pole')).toBe('holding the centre');
  });
});
