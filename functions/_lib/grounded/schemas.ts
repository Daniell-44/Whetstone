import { z } from 'zod';

// Mirror of evidence-weighted's ConsensusLevel — duplicated here as a Zod
// enum because we can't import the evidence-weighted Zod schema without
// pulling in its full module. Stay in sync if that enum changes.
const ConsensusLevelSchema = z.enum([
  'strong_support',
  'moderate_support',
  'contested',
  'moderate_opposition',
  'strong_opposition',
  'insufficient_data',
  'not_applicable',
]);

export const GroundednessSignalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('structural') }),
  z.object({
    kind: z.literal('interpretive'),
    band: z.enum(['high', 'medium', 'low']),
  }),
  z.object({
    kind:            z.literal('empirical'),
    supportingCount: z.number().int().min(0),
    opposingCount:   z.number().int().min(0),
    consensus:       ConsensusLevelSchema.nullable(),
  }),
]);
