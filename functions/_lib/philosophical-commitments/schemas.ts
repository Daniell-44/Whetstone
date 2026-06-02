import { z } from 'zod';

export const ETHICAL_FRAMEWORKS = [
  'consequentialist', 'deontological', 'virtue_ethics',
  'contractualist', 'utilitarian', 'pluralist', 'unclear',
] as const;

export const EPISTEMIC_COMMITMENTS = [
  'empiricist', 'rationalist', 'experiential',
  'authoritative', 'mixed', 'unclear',
] as const;

export const POLITICAL_FRAMEWORKS = [
  'liberal', 'libertarian', 'communitarian', 'conservative',
  'progressive', 'socialist', 'pluralist', 'unclear',
] as const;

export const METHODOLOGICAL_COMMITMENTS = [
  'reductionist', 'holist', 'individualist', 'structuralist',
  'universalist', 'contextualist', 'mixed', 'unclear',
] as const;

export const FRAMEWORK_TYPES = [
  'ethical', 'epistemic', 'political', 'methodological',
] as const;

const FrameworkDetectionSchema = <T extends z.ZodTypeAny>(frameworkEnum: T) =>
  z.object({
    framework:   frameworkEnum,
    evidence:    z.string().min(1),
    explanation: z.string().min(1),
    confidence:  z.number().int().min(0).max(100),
  });

export const AlternativePerspectiveSchema = z.object({
  framework:     z.string().min(1),
  frameworkType: z.enum(FRAMEWORK_TYPES),
  objection:     z.string().min(1),
  specificity:   z.string().min(1),
});

export const PhilosophicalCommitmentsResultSchema = z.object({
  ethical:         FrameworkDetectionSchema(z.enum(ETHICAL_FRAMEWORKS)).nullable(),
  epistemic:       FrameworkDetectionSchema(z.enum(EPISTEMIC_COMMITMENTS)).nullable(),
  political:       FrameworkDetectionSchema(z.enum(POLITICAL_FRAMEWORKS)).nullable(),
  methodological:  FrameworkDetectionSchema(z.enum(METHODOLOGICAL_COMMITMENTS)).nullable(),
  alternativePerspectives: z.array(AlternativePerspectiveSchema).min(1).max(3),
  notes: z.string().nullable(),
});
