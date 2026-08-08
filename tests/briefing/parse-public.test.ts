import { describe, it, expect } from 'vitest';
import { parseBriefingFile } from '../../functions/_lib/briefing/parse';

// The ::public block: tick rows, question rows with authored </> side
// markers, prompt rows with an optional prefill column. The side mapping is
// authored, never inferred — the parser must carry exactly what the marker
// says and nothing when there is none.
const MD = `---
question: T
axisLeft: left pole
axisRight: right pole
publishedDate: 2026-08-09
---

::public label="The public" stripcaption="cap" stripnote="note {spread}" gapnote="gap" dialquestion="Which?"
tick | 37 | Alpha, 2025
tick | 61 | Beta, 2024
q | Which source is dearest? | Gamma, Jul 2024 | <renewables 35, fossil fuels 27, >nuclear 38 | wording note
q | Priorities? | Delta, 2024 | cutting household bills 48, cutting emissions 37, avoiding blackouts 15
q | Spaced markers? | Epsilon | < first 10, > second 20 | n
prompt | Plain label
prompt | With prefill | Contest this premise. My contest:
`;

function publicBlock() {
  const b = parseBriefingFile(MD, 'pp');
  const blk = b.blocks.find((x) => x.type === 'public');
  if (!blk || blk.type !== 'public') throw new Error('no public block');
  return blk;
}

describe('::public parsing', () => {
  it('parses ticks with value and label', () => {
    const p = publicBlock();
    expect(p.ticks).toEqual([
      { value: 37, label: 'Alpha, 2025' },
      { value: 61, label: 'Beta, 2024' },
    ]);
  });

  it('carries authored side markers and strips them from the label', () => {
    const p = publicBlock();
    expect(p.questions[0].bars).toEqual([
      { label: 'renewables', value: 35, side: 'left' },
      { label: 'fossil fuels', value: 27 },
      { label: 'nuclear', value: 38, side: 'right' },
    ]);
  });

  it('never invents a side: unmarked rows have none, multi-word labels survive', () => {
    const p = publicBlock();
    expect(p.questions[1].bars).toEqual([
      { label: 'cutting household bills', value: 48 },
      { label: 'cutting emissions', value: 37 },
      { label: 'avoiding blackouts', value: 15 },
    ]);
    expect(p.questions[1].bars.every((b) => !('side' in b))).toBe(true);
  });

  it('tolerates a space between marker and label', () => {
    const p = publicBlock();
    expect(p.questions[2].bars).toEqual([
      { label: 'first', value: 10, side: 'left' },
      { label: 'second', value: 20, side: 'right' },
    ]);
  });

  it('keeps note optional and question/source intact', () => {
    const p = publicBlock();
    expect(p.questions[0].note).toBe('wording note');
    expect(p.questions[1].note).toBeUndefined();
    expect(p.questions[0].source).toBe('Gamma, Jul 2024');
  });

  it('parses prompts with and without a prefill scaffold', () => {
    const p = publicBlock();
    expect(p.prompts).toEqual([
      { label: 'Plain label' },
      { label: 'With prefill', prefill: 'Contest this premise. My contest:' },
    ]);
  });

  it('interpolation inputs survive: strip attrs land verbatim', () => {
    const p = publicBlock();
    expect(p.stripCaption).toBe('cap');
    expect(p.stripNote).toBe('note {spread}');
    expect(p.gapNote).toBe('gap');
    expect(p.dialQuestion).toBe('Which?');
  });
});
