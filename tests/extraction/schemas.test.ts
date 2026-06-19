import { describe, it, expect } from 'vitest';
import {
  ExtractionStatementSchema,
  // Raw* carries `confidence` (model output); canonical carries `groundedness`.
  RawArgumentExtractionResultSchema as ArgumentExtractionResultSchema,
  ArgumentExtractionResultSchema as GroundedExtractionResultSchema,
  INFERENCE_RULES,
} from '../../functions/_lib/argument-extraction/schemas';

// ---------------------------------------------------------------------------
// ExtractionStatementSchema
// ---------------------------------------------------------------------------

describe('ExtractionStatementSchema — premise', () => {
  const base = {
    id:   'P1',
    type: 'premise',
    text: 'Social media platforms optimise for engagement.',
  };

  it('accepts a minimal valid premise', () => {
    expect(ExtractionStatementSchema.safeParse(base).success).toBe(true);
  });

  it('rejects missing text', () => {
    const { text, ...rest } = base;
    expect(ExtractionStatementSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid type', () => {
    expect(ExtractionStatementSchema.safeParse({ ...base, type: 'evidence' }).success).toBe(false);
  });

  it('accepts optional derivedFrom as empty array', () => {
    expect(ExtractionStatementSchema.safeParse({ ...base, derivedFrom: [] }).success).toBe(true);
  });
});

describe('ExtractionStatementSchema — conclusion', () => {
  const base = {
    id:                       'C1',
    type:                     'conclusion',
    text:                     'Regulatory intervention is justified.',
    derivedFrom:              ['P1', 'P2'],
    inferenceRule:            'modus_ponens',
    inferenceRuleExplanation: 'P1 and P2 entail C1 via the conditional.',
  };

  it('accepts a valid conclusion with all fields', () => {
    expect(ExtractionStatementSchema.safeParse(base).success).toBe(true);
  });

  it('rejects unknown inference rule', () => {
    expect(ExtractionStatementSchema.safeParse({ ...base, inferenceRule: 'magical_leap' }).success).toBe(false);
  });

  it('accepts all valid inference rules', () => {
    for (const rule of INFERENCE_RULES) {
      expect(ExtractionStatementSchema.safeParse({ ...base, inferenceRule: rule }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ArgumentExtractionResultSchema
// ---------------------------------------------------------------------------

describe('ArgumentExtractionResultSchema', () => {
  const valid = {
    centralClaim: 'Regulatory intervention is justified.',
    statements:   [
      { id: 'P1', type: 'premise', text: 'Social media optimises for engagement.' },
      { id: 'C1', type: 'conclusion', text: 'Intervention is justified.', derivedFrom: ['P1'], inferenceRule: 'modus_ponens' },
    ],
    notes:      null,
    confidence: 90,
  };

  it('accepts a valid result', () => {
    expect(ArgumentExtractionResultSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts an empty statements array (no-argument case)', () => {
    const result = ArgumentExtractionResultSchema.safeParse({
      centralClaim: '(no argument)',
      statements:   [],
      notes:        'The text does not advance a conclusion from premises.',
      confidence:   100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects confidence below 0', () => {
    expect(ArgumentExtractionResultSchema.safeParse({ ...valid, confidence: -1 }).success).toBe(false);
  });

  it('rejects confidence above 100', () => {
    expect(ArgumentExtractionResultSchema.safeParse({ ...valid, confidence: 101 }).success).toBe(false);
  });

  it('rejects non-integer confidence', () => {
    expect(ArgumentExtractionResultSchema.safeParse({ ...valid, confidence: 85.5 }).success).toBe(false);
  });

  it('rejects missing centralClaim', () => {
    const { centralClaim, ...rest } = valid;
    expect(ArgumentExtractionResultSchema.safeParse(rest).success).toBe(false);
  });

  it('accepts null notes', () => {
    expect(ArgumentExtractionResultSchema.safeParse({ ...valid, notes: null }).success).toBe(true);
  });

  it('accepts string notes', () => {
    expect(ArgumentExtractionResultSchema.safeParse({ ...valid, notes: 'P2 is implicit.' }).success).toBe(true);
  });
});

describe('ArgumentExtractionResultSchema (canonical) — groundedness', () => {
  const base = {
    centralClaim: 'Regulatory intervention is justified.',
    statements:   [{ id: 'P1', type: 'premise', text: 'Social media optimises for engagement.' }],
    notes:        null,
  };

  it('accepts a result with a groundedness signal', () => {
    expect(GroundedExtractionResultSchema.safeParse({ ...base, groundedness: { kind: 'interpretive', band: 'medium' } }).success).toBe(true);
  });

  it('rejects a result missing groundedness', () => {
    expect(GroundedExtractionResultSchema.safeParse(base).success).toBe(false);
  });
});
