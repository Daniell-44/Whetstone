import { z } from 'zod';
import { GroundednessSignalSchema } from '../grounded/schemas';

export const PresuppositionDomainSchema = z.enum([
  'ontological','normative','epistemic','causal','categorical','temporal','agent','other',
]);

export const PresuppositionContestabilitySchema = z.enum([
  'widely_shared','community_shared','contested','minority',
]);

// Raw — what the model emits (with confidence)
export const RawPresuppositionSchema = z.object({
  domain:         PresuppositionDomainSchema,
  statement:      z.string().min(5),
  triggerPassage: z.string().min(3),
  contestability: PresuppositionContestabilitySchema,
  whyItMatters:   z.string().min(5),
  alternatives:   z.array(z.string().min(3)).max(3),
  confidence:     z.number().min(0).max(100),
});

export const RawPresuppositionResultSchema = z.object({
  presuppositions: z.array(RawPresuppositionSchema).max(8),
  audienceProfile: z.string().min(10),
  notes:           z.string().nullable(),
});

// Canonical — with groundedness
export const PresuppositionSchema = z.object({
  domain:           PresuppositionDomainSchema,
  statement:        z.string().min(5),
  triggerPassage:   z.string().min(3),
  contestability:   PresuppositionContestabilitySchema,
  whyItMatters:     z.string().min(5),
  alternatives:     z.array(z.string().min(3)).max(3),
  groundedness:     GroundednessSignalSchema,
  _debugConfidence: z.number().min(0).max(100).optional(),
});

export const PresuppositionResultSchema = z.object({
  presuppositions: z.array(PresuppositionSchema).max(8),
  audienceProfile: z.string().min(10),
  notes:           z.string().nullable(),
});
