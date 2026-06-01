import { z } from 'zod';

export const INFERENCE_RULES = [
  'modus_ponens',
  'modus_tollens',
  'hypothetical_syllogism',
  'disjunctive_syllogism',
  'categorical_syllogism',
  'inductive_generalisation',
  'abduction',
  'analogy',
  'other',
] as const;

export const ExtractionStatementSchema = z.object({
  id:                        z.string().min(1),
  type:                      z.enum(['premise', 'conclusion']),
  text:                      z.string().min(1),
  derivedFrom:               z.array(z.string()).nullish(),
  inferenceRule:             z.enum(INFERENCE_RULES).nullish(),
  inferenceRuleExplanation:  z.string().nullish(),
});

export const ArgumentExtractionResultSchema = z.object({
  centralClaim: z.string().min(1),
  statements:   z.array(ExtractionStatementSchema),
  notes:        z.string().nullable(),
  confidence:   z.number().int().min(0).max(100),
});
