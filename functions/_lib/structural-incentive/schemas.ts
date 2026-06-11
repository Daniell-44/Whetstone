import { z } from 'zod';
import { GroundednessSignalSchema } from '../grounded/schemas';

export const StakeholderKindSchema = z.enum([
  'economic_position','institutional_role','political_constituency','cultural_group','professional_class','other',
]);

// Raw
export const RawInterestAlignmentSchema = z.object({
  stakeholderKind:    StakeholderKindSchema,
  whoseInterest:      z.string().min(5),
  howFramingServes:   z.string().min(5),
  triggerPassage:     z.string().min(3),
  counterStakeholder: z.string().min(5).nullable(),
  confidence:         z.number().min(0).max(100),
});

export const RawStructuralIncentiveResultSchema = z.object({
  alignments:      z.array(RawInterestAlignmentSchema).max(5),
  framingSummary:  z.string().min(10),
  importantCaveat: z.string().min(10),
  notes:           z.string().nullable(),
});

// Canonical
export const InterestAlignmentSchema = z.object({
  stakeholderKind:    StakeholderKindSchema,
  whoseInterest:      z.string().min(5),
  howFramingServes:   z.string().min(5),
  triggerPassage:     z.string().min(3),
  counterStakeholder: z.string().min(5).nullable(),
  groundedness:       GroundednessSignalSchema,
  _debugConfidence:   z.number().min(0).max(100).optional(),
});

export const StructuralIncentiveResultSchema = z.object({
  alignments:      z.array(InterestAlignmentSchema).max(5),
  framingSummary:  z.string().min(10),
  importantCaveat: z.string().min(10),
  notes:           z.string().nullable(),
});
