import { describe, it, expect } from 'vitest';
import { looksLikeAcademicReference } from '../../functions/_lib/citation-audit/engine';

// The detector separates academic "(Author, Year)" references (which can't be
// auto-checked but aren't a failure) from genuinely uncited claims.
describe('looksLikeAcademicReference', () => {
  it('detects parenthetical (Author, Year) references', () => {
    expect(looksLikeAcademicReference('trade and technology blur (Feenstra & Hanson, 1999)')).toBe(true);
    expect(looksLikeAcademicReference('the premium climbed (Goldberg & Pavcnik, 2007)')).toBe(true);
    expect(looksLikeAcademicReference('(Smith et al., 2010)')).toBe(true);
    expect(looksLikeAcademicReference('an old result (Leontief, 1953)')).toBe(true);
  });

  it('detects the prose "Author (Year)" form', () => {
    expect(looksLikeAcademicReference("Leontief's (1953) paradox")).toBe(true);
    expect(looksLikeAcademicReference('as Ricardo (1817) showed')).toBe(true);
  });

  it('does not flag prose with no academic reference', () => {
    expect(looksLikeAcademicReference('Unemployment fell to 3.4% last month.')).toBe(false);
    expect(looksLikeAcademicReference('We should invest more in schools.')).toBe(false);
  });

  it('does not flag a bare year with no author', () => {
    expect(looksLikeAcademicReference('the 2009 edition was revised')).toBe(false);
    expect(looksLikeAcademicReference('it happened in (2009)')).toBe(false);
  });
});
