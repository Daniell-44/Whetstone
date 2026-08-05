// ::diverge parsing + validation (Decision 3, options A+C combined,
// 2026-08-05): two parallel standard-form arguments, commentary pinned to
// premises, and the ::line prose run captured as the "As written" toggle pane.

import { describe, it, expect } from 'vitest';
import { parseBriefingFile, validateBriefing } from '../../functions/_lib/briefing/parse';

const FM = `---
question: Test question?
publishedDate: 2026-08-05
axisLeft: pole A
axisRight: pole B
otherTakes: none
---
`;

const POSITIONS = `
::positions
alice | Alice | The Paper | https://example.org/alice | -1 | high | her own model | Costs are lower than claimed. | Selective evidence, no selection rule. | interpretive
bob   | Bob   | The Wire  | https://example.org/bob   | 2  | med  | adjudicating
`;

const DIVERGE = `
::diverge label="Where they diverge" house="Two arguments in standard form."
::argument label="From Camp A" interest="commissioned"
1 | quoted | The first quoted premise.
2 | stated | A stated modelling assumption.
C | - | Camp A's conclusion.
::argument label="From Camp B"
1 | quoted | Camp B's quoted premise.
2 | supplied | A premise the report never states.
C | - | Camp B's conclusion.
::sharedneed
that a model settles the question.

::pin source=alice at="Camp A P2"
Contests the assumption directly.

::line name="First crux"
Prose about the first crux.

More connective prose.
::enddiverge
`;

describe('::diverge parsing', () => {
  const b = parseBriefingFile(`${FM}${POSITIONS}${DIVERGE}`, 't');
  const dv = b.blocks.find((bl) => bl.type === 'diverge');

  it('parses one diverge block with label and house line', () => {
    expect(dv).toBeDefined();
    if (dv?.type !== 'diverge') return;
    expect(dv.label).toBe('Where they diverge');
    expect(dv.house).toBe('Two arguments in standard form.');
  });

  it('parses both argument columns with rows and provenance', () => {
    if (dv?.type !== 'diverge') return;
    expect(dv.a.label).toBe('From Camp A');
    expect(dv.a.interest).toBe('commissioned');
    expect(dv.a.rows).toHaveLength(3);
    expect(dv.a.rows[0].provenance).toBe('quoted');
    expect(dv.a.rows[1].provenance).toBe('stated');
    expect(dv.a.rows[2].provenance).toBe('conclusion');
    expect(dv.b.rows[1].provenance).toBe('supplied');
    expect(dv.b.interest).toBeUndefined();
  });

  it('parses the optional 4th crux column on argument rows', () => {
    const b4 = parseBriefingFile(`${FM}${POSITIONS}
::diverge
::argument label="From Camp A"
1 | quoted | Premise with a crux. | the first crux
C | - | Conclusion.
::argument label="From Camp B"
1 | quoted | Counterpart premise.
C | - | Conclusion.
::line name="x"
Prose.
::enddiverge
`, 't');
    const dv4 = b4.blocks.find((bl) => bl.type === 'diverge');
    if (dv4?.type !== 'diverge') throw new Error('no diverge block');
    expect(dv4.a.rows[0].crux).toBe('the first crux');
    expect(dv4.b.rows[0].crux).toBeUndefined();
  });

  it('captures the shared-need row and the pin with its note', () => {
    if (dv?.type !== 'diverge') return;
    expect(dv.sharedNeed).toBe('that a model settles the question.');
    expect(dv.pins).toHaveLength(1);
    expect(dv.pins[0]).toEqual({ sourceId: 'alice', at: 'Camp A P2', note: 'Contests the assumption directly.' });
  });

  it('captures the ::line run and prose as the "As written" pane, not top-level blocks', () => {
    if (dv?.type !== 'diverge') return;
    expect(dv.prose.map((p) => p.type)).toEqual(['line', 'prose', 'prose']);
    // Nothing leaks into the top-level flow.
    expect(b.blocks.filter((bl) => bl.type === 'line' || bl.type === 'prose')).toHaveLength(0);
  });

  it('terminates at ::enddiverge — later blocks stay top-level', () => {
    const b2 = parseBriefingFile(`${FM}${POSITIONS}${DIVERGE}\nTrailing paragraph.\n`, 't');
    expect(b2.blocks.some((bl) => bl.type === 'prose' && bl.text === 'Trailing paragraph.')).toBe(true);
  });

  it('degrades to plain prose when no ::argument columns exist', () => {
    const b3 = parseBriefingFile(`${FM}${POSITIONS}
::diverge
::line name="Only prose"
Some prose.
::enddiverge
`, 't');
    expect(b3.blocks.some((bl) => bl.type === 'diverge')).toBe(false);
    expect(b3.blocks.some((bl) => bl.type === 'prose' && bl.text === 'Some prose.')).toBe(true);
  });
});

describe('::diverge validation', () => {
  const base = `${FM}${POSITIONS}`;

  it('accepts the well-formed block', () => {
    const issues = validateBriefing(parseBriefingFile(`${base}${DIVERGE}`, 't'));
    expect(issues.filter((i) => i.includes('diverge'))).toHaveLength(0);
  });

  it('flags a single-column diverge', () => {
    const issues = validateBriefing(parseBriefingFile(`${base}
::diverge
::argument label="Lonely"
1 | quoted | Premise.
C | - | Conclusion.
::line name="x"
Prose.
::enddiverge
`, 't'));
    expect(issues.some((i) => i.includes('two `::argument` columns'))).toBe(true);
  });

  it('flags a column without exactly one conclusion', () => {
    const issues = validateBriefing(parseBriefingFile(`${base}
::diverge
::argument label="From Camp A"
1 | quoted | Premise only.
::argument label="From Camp B"
1 | quoted | Premise.
C | - | Conclusion.
::line name="x"
Prose.
::enddiverge
`, 't'));
    expect(issues.some((i) => i.includes('Camp A') && i.includes('exactly one conclusion'))).toBe(true);
  });

  it('flags a pin whose source is unknown or unaudited', () => {
    const issues = validateBriefing(parseBriefingFile(`${base}
::diverge
::argument label="From Camp A"
1 | quoted | Premise.
C | - | Conclusion.
::argument label="From Camp B"
1 | quoted | Premise.
C | - | Conclusion.
::pin source=ghost at="Camp A P1"
::pin source=bob at="Camp B P1"
::line name="x"
Prose.
::enddiverge
`, 't'));
    expect(issues.some((i) => i.includes('source=ghost') && i.includes('matches no'))).toBe(true);
    // bob has no quote+auditNote and no ::position block → unaudited.
    expect(issues.some((i) => i.includes('"bob"') && i.includes('unaudited'))).toBe(true);
  });

  it('flags an empty "As written" pane', () => {
    const issues = validateBriefing(parseBriefingFile(`${base}
::diverge
::argument label="From Camp A"
1 | quoted | Premise.
C | - | Conclusion.
::argument label="From Camp B"
1 | quoted | Premise.
C | - | Conclusion.
::enddiverge
`, 't'));
    expect(issues.some((i) => i.includes('As written'))).toBe(true);
  });
});
