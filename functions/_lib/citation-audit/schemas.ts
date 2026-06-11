import { z } from 'zod';
import type { CitationAuditResult } from './types';
import { GroundednessSignalSchema } from '../grounded/schemas';

// ---------------------------------------------------------------------------
// Stage 1 — extracted claims (output of claim-extraction LLM call)
// ---------------------------------------------------------------------------

export const ExtractedClaimSchema = z.object({
  claim:           z.string().min(1),
  evidenceQuote:   z.string().min(1),
  citationUrl:     z.string().url().nullable(),
  citationContext: z.string().nullable().optional(),
});

export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

export const ExtractedClaimsSchema = z.object({
  claims: z.array(ExtractedClaimSchema),
});

// ---------------------------------------------------------------------------
// Stage 2 — per-claim verdict (output of verdict LLM call)
// ---------------------------------------------------------------------------

const CitationVerdictEnum = z.enum([
  'well_cited',
  'weakly_cited',
  'mismatched',
  'uncited',
  'unfetchable',
  'non_factual',
]);

export const VerdictResultSchema = z.object({
  verdict:            CitationVerdictEnum,
  verdictExplanation: z.string().min(1),
  sourceExcerpt:      z.string().max(250).nullable(),
  confidence:         z.number().int().min(0).max(100),
});

export type VerdictResult = z.infer<typeof VerdictResultSchema>;

// ---------------------------------------------------------------------------
// Final CitationAuditResult (for storage validation)
// ---------------------------------------------------------------------------

export const CitedClaimSchema = z.object({
  claim:              z.string().min(1),
  evidenceQuote:      z.string().min(1),
  citationUrl:        z.string().nullable(),
  citationContext:    z.string().optional(),
  verdict:            CitationVerdictEnum,
  verdictExplanation: z.string().min(1),
  sourceExcerpt:      z.string().nullable(),
  sourceTitle:        z.string().nullable(),
  sourcePublication:  z.string().nullable(),
  groundedness:       GroundednessSignalSchema,
  _debugConfidence:   z.number().int().min(0).max(100).optional(),
});

export const CitationAuditSummarySchema = z.object({
  total:       z.number().int().min(0),
  wellCited:   z.number().int().min(0),
  weaklyCited: z.number().int().min(0),
  mismatched:  z.number().int().min(0),
  uncited:     z.number().int().min(0),
  unfetchable: z.number().int().min(0),
});

export const CitationAuditResultSchema = z.object({
  factualClaims: z.array(CitedClaimSchema),
  notes:         z.string().nullable(),
  summary:       CitationAuditSummarySchema,
}).refine(
  (data) => data.summary.total === data.factualClaims.length,
  { message: 'summary.total must equal factualClaims.length' },
).refine(
  (data) => {
    const { wellCited, weaklyCited, mismatched, uncited, unfetchable } = data.summary;
    const counted = data.factualClaims.filter(
      c => c.verdict === 'well_cited' || c.verdict === 'weakly_cited' ||
           c.verdict === 'mismatched' || c.verdict === 'uncited' || c.verdict === 'unfetchable',
    ).length;
    const sumCounts = wellCited + weaklyCited + mismatched + uncited + unfetchable;
    return sumCounts === counted;
  },
  { message: 'Summary counts must add up to the non-non_factual claims' },
) as z.ZodType<CitationAuditResult>;
