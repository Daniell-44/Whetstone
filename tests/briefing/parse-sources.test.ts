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
    const issues = validateBriefing(b);
    expect(issues.some((i) => i.includes('cengiz') && i.includes('no ::position audit card'))).toBe(true);
    expect(issues.some((i) => i.includes('jardim') && i.includes('no ::position audit card'))).toBe(false);
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

// ---------------------------------------------------------------------------
// Inline emphasis + the unified source list
// ---------------------------------------------------------------------------

import { inlineMarkup } from '../../functions/_lib/briefing/parse';
import { citedSources } from '../../functions/_lib/briefing/types';

describe('inlineMarkup', () => {
  it('renders the emphasis authors actually write', () => {
    // Five published sentences currently show these asterisks to readers.
    expect(inlineMarkup('Latin rendered it *petitio principii*, "assuming"'))
      .toBe('Latin rendered it <em>petitio principii</em>, "assuming"');
  });

  it('handles strong, and does not let it be eaten by emphasis', () => {
    expect(inlineMarkup('a **hard** rule')).toBe('a <strong>hard</strong> rule');
    expect(inlineMarkup('**both** and *one*')).toBe('<strong>both</strong> and <em>one</em>');
  });

  it('escapes markup before converting, so prose cannot inject HTML', () => {
    expect(inlineMarkup('if x < y and <script>alert(1)</script>'))
      .toBe('if x &lt; y and &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('leaves a lone asterisk and mid-word asterisks alone', () => {
    expect(inlineMarkup('a * b')).toBe('a * b');
    expect(inlineMarkup('2*3*4')).toBe('2*3*4');
  });

  it('does not run emphasis across a line break', () => {
    expect(inlineMarkup('open *here\nand closed* there')).toBe('open *here\nand closed* there');
  });

  it('leaves ordinary prose untouched', () => {
    const plain = 'No emphasis in this sentence at all.';
    expect(inlineMarkup(plain)).toBe(plain);
  });
});

describe('citedSources', () => {
  const base = { slug: 's', question: 'q', publishedDate: '2026-01-01', blocks: [], sources: [] } as any;

  it('counts both v2 tables — the feed card read only the empty legacy one', () => {
    const b = { ...base,
      positionSources: [{ id: 'a', label: 'A', url: 'https://a.example', stance: 0, confidence: 'med' }],
      evidenceSources: [{ id: 'b', label: 'B', url: 'https://b.example', note: 'n' }],
    };
    expect(citedSources(b)).toHaveLength(2);
    expect(citedSources(b).map(s => s.role)).toEqual(['position', 'evidence']);
  });

  it('cites a url appearing in both tables once', () => {
    const b = { ...base,
      positionSources: [{ id: 'a', label: 'A', url: 'https://same.example', stance: 0, confidence: 'med' }],
      evidenceSources: [{ id: 'b', label: 'A again', url: 'https://same.example', note: 'n' }],
    };
    expect(citedSources(b)).toHaveLength(1);
    expect(citedSources(b)[0]!.role).toBe('position');
  });

  it('still reads a legacy single-table briefing', () => {
    const b = { ...base, sources: [{ id: 'l', label: 'Legacy', url: 'https://l.example', side: 'left', leaning: 0 }] };
    expect(citedSources(b)).toHaveLength(1);
  });

  it('skips a legacy row with no url, which cannot be cited', () => {
    const b = { ...base, sources: [{ id: 'l', label: 'Legacy', side: 'left', leaning: 0 }] };
    expect(citedSources(b)).toHaveLength(0);
  });
});
