import { z } from 'zod';

const POSTURES = [
  'authoritative', 'adversarial', 'conciliatory', 'pedagogical',
  'confessional', 'ironic', 'prophetic', 'detached', 'mixed',
] as const;

const REGISTERS = [
  'measured', 'urgent', 'indignant', 'sardonic',
  'earnest', 'clinical', 'elegiac', 'polemic',
] as const;

const TonalMoveSchema = z.object({
  passage:    z.string().min(1),
  move:       z.string().min(1),
  effect:     z.string().min(1),
  severity:   z.enum(['high', 'medium', 'low']),
  confidence: z.number().int().min(0).max(100),
});

export const TonePostureResultSchema = z.object({
  posture:              z.enum(POSTURES),
  postureEvidence:      z.string().min(1),
  postureExplanation:   z.string().min(1),
  register:             z.enum(REGISTERS),
  registerEvidence:     z.string().min(1),
  registerExplanation:  z.string().min(1),
  tonalMoves:           z.array(TonalMoveSchema),
  audiencePosition:     z.string().min(1),
  notes:                z.string().nullable(),
  confidence:           z.number().int().min(0).max(100),
});
