import { describe, it, expect } from 'vitest';
import {
  AlternativePerspectiveSchema,
  PhilosophicalCommitmentsResultSchema,
  ETHICAL_FRAMEWORKS,
  EPISTEMIC_COMMITMENTS,
  POLITICAL_FRAMEWORKS,
  METHODOLOGICAL_COMMITMENTS,
  FRAMEWORK_TYPES,
} from '../../functions/_lib/philosophical-commitments/schemas';

// ---------------------------------------------------------------------------
// AlternativePerspectiveSchema
// ---------------------------------------------------------------------------

describe('AlternativePerspectiveSchema', () => {
  const base = {
    framework:     'Deontological',
    frameworkType: 'ethical',
    objection:     'Mandatory helmet laws violate individual autonomy as a categorical duty.',
    specificity:   'The draft cites cost-saving as justification but deontology rejects aggregative welfare as grounds for coercion.',
  };

  it('accepts a valid alternative perspective', () => {
    expect(AlternativePerspectiveSchema.safeParse(base).success).toBe(true);
  });

  it('rejects invalid frameworkType', () => {
    expect(AlternativePerspectiveSchema.safeParse({ ...base, frameworkType: 'ontological' }).success).toBe(false);
  });

  it('accepts all valid frameworkTypes', () => {
    for (const ft of FRAMEWORK_TYPES) {
      expect(AlternativePerspectiveSchema.safeParse({ ...base, frameworkType: ft }).success).toBe(true);
    }
  });

  it('rejects empty framework string', () => {
    expect(AlternativePerspectiveSchema.safeParse({ ...base, framework: '' }).success).toBe(false);
  });

  it('rejects empty objection string', () => {
    expect(AlternativePerspectiveSchema.safeParse({ ...base, objection: '' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PhilosophicalCommitmentsResultSchema
// ---------------------------------------------------------------------------

const validDetection = (framework: string) => ({
  framework,
  evidence:    'The draft appeals to welfare outcomes.',
  explanation: 'Consequentialist framing treats aggregate welfare as the criterion.',
  confidence:  75,
});

const validResult = {
  ethical:         validDetection('consequentialist'),
  epistemic:       validDetection('empiricist'),
  political:       null,
  methodological:  null,
  alternativePerspectives: [
    {
      framework:     'Deontological',
      frameworkType: 'ethical',
      objection:     'Autonomy cannot be traded off against welfare gains.',
      specificity:   'The draft uses cost-saving as justification, which a deontologist rejects.',
    },
  ],
  notes: null,
};

describe('PhilosophicalCommitmentsResultSchema', () => {
  it('accepts a valid result with some null dimensions', () => {
    expect(PhilosophicalCommitmentsResultSchema.safeParse(validResult).success).toBe(true);
  });

  it('accepts all dimensions as null', () => {
    const result = PhilosophicalCommitmentsResultSchema.safeParse({
      ...validResult,
      ethical:        null,
      epistemic:      null,
      political:      null,
      methodological: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all ethical frameworks', () => {
    for (const fw of ETHICAL_FRAMEWORKS) {
      const result = PhilosophicalCommitmentsResultSchema.safeParse({
        ...validResult,
        ethical: validDetection(fw),
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all epistemic commitments', () => {
    for (const fw of EPISTEMIC_COMMITMENTS) {
      const result = PhilosophicalCommitmentsResultSchema.safeParse({
        ...validResult,
        epistemic: validDetection(fw),
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all political frameworks', () => {
    for (const fw of POLITICAL_FRAMEWORKS) {
      const result = PhilosophicalCommitmentsResultSchema.safeParse({
        ...validResult,
        political: validDetection(fw),
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all methodological commitments', () => {
    for (const fw of METHODOLOGICAL_COMMITMENTS) {
      const result = PhilosophicalCommitmentsResultSchema.safeParse({
        ...validResult,
        methodological: validDetection(fw),
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an unknown ethical framework', () => {
    const result = PhilosophicalCommitmentsResultSchema.safeParse({
      ...validResult,
      ethical: validDetection('marxist'),
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero alternative perspectives', () => {
    const result = PhilosophicalCommitmentsResultSchema.safeParse({
      ...validResult,
      alternativePerspectives: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than three alternative perspectives', () => {
    const alt = validResult.alternativePerspectives[0]!;
    const result = PhilosophicalCommitmentsResultSchema.safeParse({
      ...validResult,
      alternativePerspectives: [alt, alt, alt, alt],
    });
    expect(result.success).toBe(false);
  });

  it('accepts null notes', () => {
    expect(PhilosophicalCommitmentsResultSchema.safeParse({ ...validResult, notes: null }).success).toBe(true);
  });

  it('accepts string notes', () => {
    expect(PhilosophicalCommitmentsResultSchema.safeParse({ ...validResult, notes: 'Short policy brief.' }).success).toBe(true);
  });

  it('rejects confidence above 100', () => {
    const result = PhilosophicalCommitmentsResultSchema.safeParse({
      ...validResult,
      ethical: { ...validDetection('consequentialist'), confidence: 101 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence below 0', () => {
    const result = PhilosophicalCommitmentsResultSchema.safeParse({
      ...validResult,
      ethical: { ...validDetection('consequentialist'), confidence: -1 },
    });
    expect(result.success).toBe(false);
  });
});
