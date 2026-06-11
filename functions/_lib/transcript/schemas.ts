import { z } from 'zod';

const SEGMENT_KINDS = [
  'argument', 'narrative', 'sponsor_read',
  'introduction', 'tangent', 'listener_mail', 'other',
] as const;

const CROSS_FINDING_KINDS = [
  'walked_back_claim',
  'doubled_down_claim',
  'repeated_unstated_warrant',
  'shifted_framing',
  'unresolved_counterargument',
  'consistent_strength',
  'other',
] as const;

export const ArgumentSegmentSchema = z.object({
  id:           z.string().min(1),
  kind:         z.enum(SEGMENT_KINDS),
  startSec:     z.number().min(0),
  endSec:       z.number().min(0),
  claimSummary: z.string().min(1),
  text:         z.string().min(1),
  confidence:   z.number().int().min(0).max(100),
});

export const SegmentationResultSchema = z.object({
  segments:      z.array(ArgumentSegmentSchema),
  totalSegments: z.number().int().min(0),
  argumentCount: z.number().int().min(0),
  excludedCount: z.number().int().min(0),
  notes:         z.string().nullable(),
});

export const CrossSegmentFindingSchema = z.object({
  kind:        z.enum(CROSS_FINDING_KINDS),
  segmentIds:  z.array(z.string()).min(1),
  description: z.string().min(1),
  severity:    z.enum(['high', 'medium', 'low']),
  confidence:  z.number().int().min(0).max(100),
});

export const CrossSegmentSynthesisSchema = z.object({
  findings:       z.array(CrossSegmentFindingSchema),
  overallSummary: z.string().min(1),
  notes:          z.string().nullable(),
});
