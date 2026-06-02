import { describe, it, expect } from 'vitest';
import {
  ExtractedClaimsSchema,
  VerdictResultSchema,
  CitationAuditResultSchema,
} from '../../functions/_lib/citation-audit/schemas';

// ---------------------------------------------------------------------------
// Stage 1 extraction schema
// ---------------------------------------------------------------------------

describe('ExtractedClaimsSchema', () => {
  it('accepts a well-formed extraction with mixed citationUrls', () => {
    const result = ExtractedClaimsSchema.safeParse({
      claims: [
        {
          claim:           'Unemployment fell to 3.4%',
          evidenceQuote:   'Unemployment fell to 3.4% last month',
          citationUrl:     'https://example.org/bls',
          citationContext: 'Bureau of Labor Statistics, 2024',
        },
        {
          claim:         'Workers in the gig economy make up 36% of the labour force',
          evidenceQuote: 'Workers in the gig economy now make up 36%',
          citationUrl:   null,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.claims).toHaveLength(2);
  });

  it('rejects a claim with an invalid URL', () => {
    const result = ExtractedClaimsSchema.safeParse({
      claims: [
        { claim: 'X', evidenceQuote: 'X', citationUrl: 'not-a-url' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a claim with an empty string claim', () => {
    const result = ExtractedClaimsSchema.safeParse({
      claims: [
        { claim: '', evidenceQuote: 'Something', citationUrl: null },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty claims array', () => {
    const result = ExtractedClaimsSchema.safeParse({ claims: [] });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stage 2 verdict schema
// ---------------------------------------------------------------------------

describe('VerdictResultSchema', () => {
  it('accepts a well_cited verdict with excerpt', () => {
    const result = VerdictResultSchema.safeParse({
      verdict:            'well_cited',
      verdictExplanation: 'The source clearly states the statistic.',
      sourceExcerpt:      'unemployment fell to 3.4 percent',
      confidence:         92,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a mismatched verdict with null excerpt', () => {
    const result = VerdictResultSchema.safeParse({
      verdict:            'mismatched',
      verdictExplanation: 'Source says 4.1%, not 3.4%.',
      sourceExcerpt:      null,
      confidence:         85,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown verdict value', () => {
    const result = VerdictResultSchema.safeParse({
      verdict:            'made_up',
      verdictExplanation: 'Something',
      sourceExcerpt:      null,
      confidence:         50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence outside 0-100', () => {
    const result = VerdictResultSchema.safeParse({
      verdict:            'weakly_cited',
      verdictExplanation: 'Related but not specific.',
      sourceExcerpt:      null,
      confidence:         101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects sourceExcerpt over 250 chars', () => {
    const result = VerdictResultSchema.safeParse({
      verdict:            'well_cited',
      verdictExplanation: 'Matches.',
      sourceExcerpt:      'a'.repeat(251),
      confidence:         90,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid verdict values', () => {
    const verdicts = ['well_cited', 'weakly_cited', 'mismatched', 'uncited', 'unfetchable', 'non_factual'] as const;
    for (const verdict of verdicts) {
      const result = VerdictResultSchema.safeParse({
        verdict,
        verdictExplanation: 'explanation',
        sourceExcerpt:      null,
        confidence:         75,
      });
      expect(result.success, verdict).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Full CitationAuditResultSchema
// ---------------------------------------------------------------------------

function validResult() {
  return {
    factualClaims: [
      {
        claim:              'France banned smartphones in 2018',
        evidenceQuote:      'France banned smartphones in 2018',
        citationUrl:        null,
        verdict:            'uncited',
        verdictExplanation: 'No citation provided.',
        sourceExcerpt:      null,
        sourceTitle:        null,
        sourcePublication:  null,
        confidence:         95,
      },
      {
        claim:              'Sleep deprivation affects 62% of teens',
        evidenceQuote:      '62% of teenagers',
        citationUrl:        'https://example.org/aasm',
        verdict:            'unfetchable',
        verdictExplanation: 'Could not retrieve source.',
        sourceExcerpt:      null,
        sourceTitle:        null,
        sourcePublication:  null,
        confidence:         100,
      },
    ],
    notes: null,
    summary: {
      total:       2,
      wellCited:   0,
      weaklyCited: 0,
      mismatched:  0,
      uncited:     1,
      unfetchable: 1,
    },
  };
}

describe('CitationAuditResultSchema', () => {
  it('accepts a well-formed result', () => {
    expect(CitationAuditResultSchema.safeParse(validResult()).success).toBe(true);
  });

  it('rejects when summary.total !== factualClaims.length', () => {
    const bad = { ...validResult(), summary: { ...validResult().summary, total: 99 } };
    expect(CitationAuditResultSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects when summary counts do not add up', () => {
    const bad = { ...validResult(), summary: { ...validResult().summary, uncited: 5 } };
    expect(CitationAuditResultSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts a result with notes', () => {
    const withNotes = { ...validResult(), notes: 'Mixed citation styles detected.' };
    expect(CitationAuditResultSchema.safeParse(withNotes).success).toBe(true);
  });

  it('accepts a result with zero claims', () => {
    const empty = {
      factualClaims: [],
      notes:         null,
      summary:       { total: 0, wellCited: 0, weaklyCited: 0, mismatched: 0, uncited: 0, unfetchable: 0 },
    };
    expect(CitationAuditResultSchema.safeParse(empty).success).toBe(true);
  });

  it('accepts non_factual claims that are excluded from summary counts', () => {
    const withNonFactual = {
      factualClaims: [
        {
          claim:              'This policy is misguided',
          evidenceQuote:      'This policy is misguided',
          citationUrl:        null,
          verdict:            'non_factual',
          verdictExplanation: 'Normative claim.',
          sourceExcerpt:      null,
          sourceTitle:        null,
          sourcePublication:  null,
          confidence:         80,
        },
      ],
      notes: null,
      summary: { total: 1, wellCited: 0, weaklyCited: 0, mismatched: 0, uncited: 0, unfetchable: 0 },
    };
    expect(CitationAuditResultSchema.safeParse(withNonFactual).success).toBe(true);
  });
});
