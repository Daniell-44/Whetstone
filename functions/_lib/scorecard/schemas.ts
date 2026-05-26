import { z } from 'zod';

// ---------------------------------------------------------------------------
// Scorecard output schema (used by storage layer to validate before writing)
// ---------------------------------------------------------------------------

export const ScorecardSourceSchema = z.object({
  title:       z.string().min(1),
  publication: z.string().min(1),
  url:         z.string().min(1),
});

export const ToulminChainSchema = z.object({
  claim:   z.string().min(1),
  grounds: z.string().min(1),
  warrant: z.string().min(1),
});

export const ScorecardPositionSchema = z.object({
  label:     z.string().min(1),
  bestCase:  ToulminChainSchema,
  fatalFlaw: z.object({ name: z.string().min(1), explanation: z.string().min(1) }),
  sources:   z.array(ScorecardSourceSchema).min(1),
});

export const ScorecardSchema = z.object({
  slug:          z.string().min(1),
  question:      z.string().min(1),
  dek:           z.string().min(1),
  positions:     z.array(ScorecardPositionSchema).min(2).max(5),
  metaAnalysis:  z.object({ bridgingWarrant: z.string().min(1), explanation: z.string().min(1) }),
  publishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ScorecardZod = z.infer<typeof ScorecardSchema>;

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export const DebateArticleInputSchema = z.object({
  title:       z.string().min(1),
  publication: z.string().min(1),
  url:         z.string().min(1),
  text:        z.string().min(1, 'Article text must not be empty'),
});

export const DebatePositionInputSchema = z.object({
  label:    z.string().min(1),
  articles: z.array(DebateArticleInputSchema).min(1).max(5),
});

export const DebateInputSchema = z.object({
  question:  z.string().min(1),
  positions: z.array(DebatePositionInputSchema).min(2).max(5),
});

export type DebateArticleInput  = z.infer<typeof DebateArticleInputSchema>;
export type DebatePositionInput = z.infer<typeof DebatePositionInputSchema>;
export type DebateInput         = z.infer<typeof DebateInputSchema>;

// ---------------------------------------------------------------------------
// Stage 1 — position synthesis output (one per position)
// ---------------------------------------------------------------------------

export const Stage1OutputSchema = z.object({
  bestCase: z.object({
    claim:   z.string().min(1),
    grounds: z.string().min(1),
    warrant: z.string().min(1),
  }),
  fatalFlaw: z.object({
    name:        z.string().min(1),
    explanation: z.string().min(1),
  }),
});

export type Stage1Output = z.infer<typeof Stage1OutputSchema>;

// ---------------------------------------------------------------------------
// Stage 2 — meta-analysis output (one per scorecard)
// ---------------------------------------------------------------------------

export const Stage2OutputSchema = z.object({
  dek:             z.string().min(1),
  bridgingWarrant: z.string().min(1),
  explanation:     z.string().min(1),
});

export type Stage2Output = z.infer<typeof Stage2OutputSchema>;
