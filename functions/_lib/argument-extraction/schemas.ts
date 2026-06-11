import { z } from 'zod';
import { GroundednessSignalSchema } from '../grounded/schemas';

export const INFERENCE_RULES = [
  'modus_ponens','modus_tollens','hypothetical_syllogism','disjunctive_syllogism',
  'categorical_syllogism','inductive_generalisation','abduction','analogy','other',
] as const;

export const CLAIM_TYPES = [
  'empirical_contested','empirical_uncontested','normative','definitional','modal_predictive',
] as const;

export const ExtractionStatementSchema = z.object({
  id:                        z.string().min(1),
  type:                      z.enum(['premise','conclusion']),
  text:                      z.string().min(1),
  claimType:                 z.enum(CLAIM_TYPES).default('empirical_contested'),
  derivedFrom:               z.array(z.string()).nullish(),
  inferenceRule:             z.enum(INFERENCE_RULES).nullish(),
  inferenceRuleExplanation:  z.string().nullish(),
});

// Raw — model emits confidence on the result
export const RawArgumentExtractionResultSchema = z.object({
  centralClaim: z.string().min(1),
  statements:   z.array(ExtractionStatementSchema),
  notes:        z.string().nullable(),
  confidence:   z.number().int().min(0).max(100),
});

// Canonical — groundedness on the result
export const ArgumentExtractionResultSchema = z.object({
  centralClaim:     z.string().min(1),
  statements:       z.array(ExtractionStatementSchema),
  notes:            z.string().nullable(),
  groundedness:     GroundednessSignalSchema,
  _debugConfidence: z.number().int().min(0).max(100).optional(),
});
