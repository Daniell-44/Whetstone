import { describe, it, expect } from 'vitest';
import {
  skeletonFromExtraction,
  findingsFromAudit,
  warrantsFromAudit,
  type ExtractionLike,
  type AuditLike,
} from '../../src/lib/argument-core/adapters';
import { locateQuote } from '../../src/lib/argument-core/locate';
import { isFatal } from '../../src/lib/argument-core/fatal';

const extraction: ExtractionLike = {
  centralClaim: 'Housing remains the safest investment an ordinary buyer can make.',
  statements: [
    {
      id: 'p1',
      type: 'premise',
      text: 'Australian house prices have risen through most of the last forty years.',
    },
    {
      id: 'p2',
      type: 'premise',
      text: 'Interest rates are expected to fall next year.',
    },
    {
      id: 'c1',
      type: 'conclusion',
      text: 'Housing remains the safest investment an ordinary buyer can make.',
      derivedFrom: ['p1'],
      inferenceRule: 'inductive_generalisation',
      inferenceRuleExplanation: 'Projects the past trend forward.',
    },
  ],
};

describe('skeletonFromExtraction', () => {
  const skeleton = skeletonFromExtraction(extraction);

  it('lifts the central claim once, without duplicating the conclusion text', () => {
    expect(skeleton.claims).toEqual([
      'Housing remains the safest investment an ordinary buyer can make.',
    ]);
  });

  it('marks direct parents of a conclusion as crux premises', () => {
    expect(skeleton.premises.find((p) => p.id === 'p1')?.crux).toBe(true);
    expect(skeleton.premises.find((p) => p.id === 'p2')?.crux).toBeUndefined();
  });

  it('humanises inference rule names and keeps the explanation as the note', () => {
    expect(skeleton.links).toEqual([
      {
        from: ['p1'],
        to: 'C',
        rule: 'inductive generalisation',
        note: 'Projects the past trend forward.',
      },
    ]);
  });
});

describe('locateQuote', () => {
  const skeleton = skeletonFromExtraction(extraction);

  it('lands a conclusion-worded quote on the conclusion', () => {
    expect(
      locateQuote('housing is the safest investment an ordinary buyer could make', skeleton),
    ).toBe('conclusion');
  });

  it('lands a crux-premise quote on crux-premise', () => {
    expect(
      locateQuote('house prices have risen for most of the last forty years', skeleton),
    ).toBe('crux-premise');
  });

  it('lands a non-crux premise quote on aside', () => {
    expect(locateQuote('interest rates are expected to fall', skeleton)).toBe('aside');
  });

  it('stays unknown when nothing clears the threshold — the bar never fires blind', () => {
    expect(locateQuote('the umpire made a poor call at the weekend match', skeleton)).toBe(
      'unknown',
    );
  });
});

describe('findingsFromAudit + the fatal bar, end to end', () => {
  const skeleton = skeletonFromExtraction(extraction);
  const audit: AuditLike = {
    namedFallacies: [
      {
        name: 'Circular reasoning',
        quote: 'housing is the safest investment an ordinary buyer could make',
        explanation: 'The conclusion restates its own support.',
        severity: 'high',
        groundedness: { kind: 'structural' },
      },
      {
        name: 'Appeal to consequences',
        quote: 'interest rates are expected to fall',
        explanation: 'Hope doing the work of evidence.',
        severity: 'high',
        groundedness: { kind: 'structural' },
      },
    ],
    toulmin: {
      unstatedWarrants: [
        { warrant: 'Past conditions persist.', necessity: 'Trend projection needs its causes intact.' },
      ],
    },
  };

  it('maps groundedness.kind flat and locates each quote', () => {
    const findings = findingsFromAudit(audit, skeleton);
    expect(findings[0]).toMatchObject({ groundedness: 'structural', location: 'conclusion' });
    expect(findings[1]).toMatchObject({ location: 'aside' });
  });

  it('only the load-bearing finding clears the fatal bar', () => {
    const findings = findingsFromAudit(audit, skeleton);
    expect(findings.filter(isFatal)).toHaveLength(1);
    expect(findings.filter(isFatal)[0]?.name).toBe('Circular reasoning');
  });

  it('lifts unstated warrants from the toulmin analysis', () => {
    expect(warrantsFromAudit(audit)).toEqual([
      { text: 'Past conditions persist.', necessity: 'Trend projection needs its causes intact.' },
    ]);
  });

  it('tolerates a missing toulmin block', () => {
    expect(warrantsFromAudit({ namedFallacies: [] })).toEqual([]);
  });
});
