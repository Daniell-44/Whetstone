import { z } from 'zod';
import { GroundednessSignalSchema } from '../grounded/schemas';

export const EngagementQualitySchema = z.enum([
  'steelmanned','representative','weak_version','strawman','mentioned_only','absent',
]);

// Raw
export const RawOpposingPositionEngagementSchema = z.object({
  position:             z.string().min(5),
  authorTreatment:      z.string().min(5),
  triggerPassage:       z.string().min(3).nullable(),
  quality:              EngagementQualitySchema,
  whyThisQuality:       z.string().min(5),
  strongerVersion:      z.string().min(5).nullable(),
  whatChangesIfEngaged: z.string().min(5),
  confidence:           z.number().min(0).max(100),
});

export const RawDisagreementEngagementResultSchema = z.object({
  engagements:    z.array(RawOpposingPositionEngagementSchema).max(6),
  overallVerdict: z.enum(['rigorous','partial','weak','absent']),
  summary:        z.string().min(10),
  notes:          z.string().nullable(),
});

// Canonical
export const OpposingPositionEngagementSchema = z.object({
  position:             z.string().min(5),
  authorTreatment:      z.string().min(5),
  triggerPassage:       z.string().min(3).nullable(),
  quality:              EngagementQualitySchema,
  whyThisQuality:       z.string().min(5),
  strongerVersion:      z.string().min(5).nullable(),
  whatChangesIfEngaged: z.string().min(5),
  groundedness:         GroundednessSignalSchema,
  _debugConfidence:     z.number().min(0).max(100).optional(),
});

export const DisagreementEngagementResultSchema = z.object({
  engagements:    z.array(OpposingPositionEngagementSchema).max(6),
  overallVerdict: z.enum(['rigorous','partial','weak','absent']),
  summary:        z.string().min(10),
  notes:          z.string().nullable(),
});
