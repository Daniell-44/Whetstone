import { z } from 'zod';
import { GroundednessSignalSchema } from '../grounded/schemas';

export const CertaintyLevelSchema = z.enum([
  'flat_assertion','strong_modal','moderate_modal','hedge','explicit_uncertainty',
]);

export const EvidenceStateSchema = z.enum([
  'well_established','contested','limited','speculative','not_applicable',
]);

// Raw
export const RawHumilityFindingSchema = z.object({
  passage:          z.string().min(3),
  claim:            z.string().min(5),
  certainty:        CertaintyLevelSchema,
  evidenceState:    EvidenceStateSchema,
  gap:              z.string().min(5),
  suggestedFraming: z.string().min(5),
  severity:         z.enum(['high', 'medium', 'low']),
  confidence:       z.number().min(0).max(100),
});

export const RawEpistemicHumilityResultSchema = z.object({
  findings:       z.array(RawHumilityFindingSchema).max(10),
  overallVerdict: z.enum(['well_calibrated','mildly_overconfident','systematically_overconfident','underconfident','mixed']),
  summary:        z.string().min(10),
  notes:          z.string().nullable(),
});

// Canonical
export const HumilityFindingSchema = z.object({
  passage:          z.string().min(3),
  claim:            z.string().min(5),
  certainty:        CertaintyLevelSchema,
  evidenceState:    EvidenceStateSchema,
  gap:              z.string().min(5),
  suggestedFraming: z.string().min(5),
  severity:         z.enum(['high', 'medium', 'low']),
  groundedness:     GroundednessSignalSchema,
  _debugConfidence: z.number().min(0).max(100).optional(),
});

export const EpistemicHumilityResultSchema = z.object({
  findings:       z.array(HumilityFindingSchema).max(10),
  overallVerdict: z.enum(['well_calibrated','mildly_overconfident','systematically_overconfident','underconfident','mixed']),
  summary:        z.string().min(10),
  notes:          z.string().nullable(),
});
