import { z } from 'zod';

export const CrossDocumentFindingKindSchema = z.enum([
  'self_contradiction',
  'repeated_unstated_warrant',
  'shifted_position',
  'escalating_certainty',
  'consistent_strength',
  'selective_standard',
  'other',
]);

export const CrossDocEvidenceSchema = z.object({
  documentId: z.string().min(1),
  quote:      z.string().min(3),
});

export const CrossDocumentFindingSchema = z.object({
  kind:        CrossDocumentFindingKindSchema,
  documentIds: z.array(z.string().min(1)).min(1),
  description: z.string().min(10),
  evidence:    z.array(CrossDocEvidenceSchema).max(6),
  severity:    z.enum(['high', 'medium', 'low']),
  confidence:  z.number().min(0).max(100),
});

export const CrossDocumentSynthesisSchema = z.object({
  findings:       z.array(CrossDocumentFindingSchema).max(10),
  overallPattern: z.string().min(10),
  notes:          z.string().nullable(),
});
