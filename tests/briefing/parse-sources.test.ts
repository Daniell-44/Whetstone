// Source-table parsing — legacy ::sources and the v2 ::positions/::evidence
// model (D2 Option A, 2026-07-07). The memo's required guard: a column shift
// previously failed SILENTLY (dots pile at the spectrum centre); these tests
// pin every column.

import { describe, it, expect } from 'vitest';
import { parseBriefingFile, validateBriefing } from '../../functions/_lib/briefing/parse';

const FM = `---
question: Test question?
publishedDate: 2026-07-07
axisLeft: pole A
axisRight: pole B
---
`;

describe('legacy ::sources parsing (column guard)', () => {
  const b = parseBriefingFile(`${FM}
::sources
alpha | Alpha et al. | NBER | https://example.org/a | -82 | left | assessed
beta  | Beta Weekly  |      | https://example.org/b | 55  | right
gamma | Gamma        | CBO  | https://example.org/c | oops | mid
`, 't');

  it('parses every column into the right field', () => {
    expect(b.sources[0]).toEqual({
      id: 'alpha', label: 'Alpha et al.', publication: 'NBER',
      url: 'https://example.org/a', leaning: -82, side: 'left', assessed: true,
    });
  });
  it('handles empty publication and missing assessed flag', () => {
    expect(b.sources[1].publication).toBeUndefined();
    expect(b.sources[1].assessed).toBe(false);
    expect(b.sources[1].leaning).toBe(55);
  });
  it('tolerates a non-numeric leaning as centre (0), not NaN', () => {
    expect(b.sources[2].leaning).toBe(0);
  });
});

describe('v2 ::positions / ::evidence parsing', () => {
  const b = parseBriefingFile(`${FM}
::positions
jardim | Jardim et al. (Seattle) | NBER | https://example.org/j | -1 | high
cengiz | Cengiz et al.           | NBER | https://example.org/c | 7  | wat

::evidence
cbo | CBO, 2019 | CBO | https://example.org/cbo | Range estimate; midpoint 1.3M.

::position colour=0 label="Camp A" source=jardim quote="q1"
Paragraph with "q1" inside.

::audit name="Hasty Generalisation" kind=structural
Audit note.
`, 't2');

  it('parses position rows: stance and confidence', () => {
    expect(b.positionSources?.[0]).toEqual({
      id: 'jardim', label: 'Jardim et al. (Seattle)', publication: 'NBER',
      url: 'https://example.org/j', stance: -1, confidence: 'high',
    });
  });
  it('clamps out-of-range stance to the band edge and defaults bad confidence to med', () => {
    expect(b.positionSources?.[1].stance).toBe(2);
    expect(b.positionSources?.[1].confidence).toBe('med');
  });
  it('parses evidence rows with a note', () => {
    expect(b.evidenceSources?.[0]).toEqual({
      id: 'cbo', label: 'CBO, 2019', publication: 'CBO',
      url: 'https://example.org/cbo', note: 'Range estimate; midpoint 1.3M.',
    });
  });
  it('flags an unaudited plotted position (audited-by-definition rule)', () => {
    // Since the 2026-07-21 takes-merge, a plotted position is "audited" if it
    // has EITHER a ::position block OR inline `quote+auditNote` on the source
    // row. The error message changed shape accordingly.
    const issues = validateBriefing(b);
    expect(issues.some((i) => i.includes('cengiz') && i.includes('no audit'))).toBe(true);
    expect(issues.some((i) => i.includes('jardim') && i.includes('no audit'))).toBe(false);
  });
});

describe('other-takes policy + otherTakes sentinel', () => {
  it('warns when a briefing has neither ::takes nor otherTakes: none', () => {
    const b = parseBriefingFile(`${FM}\n::positions\np1 | P | X | https://e.org | -2 | high\n`, 't3');
    expect(validateBriefing(b).some((i) => i.includes('otherTakes: none'))).toBe(true);
  });
  it('accepts otherTakes: none as a stated choice', () => {
    const b = parseBriefingFile(`---
question: Q?
publishedDate: 2026-07-07
axisLeft: a
axisRight: b
otherTakes: none
---
::positions
p1 | P | X | https://e.org | -2 | high
`, 't4');
    expect(b.otherTakes).toBe('none');
    expect(validateBriefing(b).some((i) => i.includes('otherTakes: none'))).toBe(false);
  });
  it('warns when both ::positions and legacy ::sources are present', () => {
    const b = parseBriefingFile(`${FM}\n::sources\ns | S | X | https://e.org | 0 | mid\n\n::positions\np | P | X | https://e.org | 1 | med\n`, 't5');
    expect(validateBriefing(b).some((i) => i.includes('finish the migration'))).toBe(true);
  });
});
