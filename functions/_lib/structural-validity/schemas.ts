import { z } from 'zod';

const VALIDITY_VERDICTS = [
  'valid',
  'invalid',
  'inductively_strong',
  'enthymematic',
  'indeterminate',
] as const;

const SuppressedPremiseSchema = z.object({
  text:       z.string().min(1),
  role:       z.string().min(1),
  plausible:  z.boolean(),
});

const FormalPatternSchema = z.object({
  name:        z.string().min(1),
  description: z.string().min(1),
});

export const StructuralValidityResultSchema = z.object({
  verdict:              z.enum(VALIDITY_VERDICTS),
  formalPattern:        FormalPatternSchema.nullable(),
  schematicForm:        z.string().min(1),
  explanation:          z.string().min(1),
  suppressedPremises:   z.array(SuppressedPremiseSchema),
  countermodel:         z.string().nullable(),
  confidence:           z.number().int().min(0).max(100),
  notes:                z.string().nullable(),
});
