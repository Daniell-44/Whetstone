import { z } from 'zod';

export const AppealKindSchema = z.enum(['ethos', 'pathos', 'logos']);

export const RhetoricalBalanceSchema = z.object({
  ethosPercent:  z.number().min(0).max(100),
  pathosPercent: z.number().min(0).max(100),
  logosPercent:  z.number().min(0).max(100),
});

export const RhetoricalMoveSchema = z.object({
  kind:        AppealKindSchema,
  passage:     z.string().min(3),
  description: z.string().min(5),
});

export const RhetoricalModeResultSchema = z.object({
  balance:        RhetoricalBalanceSchema,
  dominantAppeal: z.union([AppealKindSchema, z.literal('mixed')]),
  moves:          z.array(RhetoricalMoveSchema).max(12),
  readerCaveat:   z.string().min(5),
  notes:          z.string().nullable(),
});
