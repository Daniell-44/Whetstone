// DUPLICATED — will be replaced by shared @whetstone/engine package at M5.
import { z } from 'zod';

const ConfidentTextSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
});

export const ToulminAnalysisSchema = z.object({
  claim:    ConfidentTextSchema,
  data:     z.array(ConfidentTextSchema),
  warrant:  ConfidentTextSchema.nullable(),
  backing:  z.array(ConfidentTextSchema),
  qualifier:        z.string().nullable(),
  rebuttal:         z.string().nullable(),
  argumentStrength: z.enum(['strong', 'moderate', 'weak', 'not_an_argument']),
});

export const FallacyFlagSchema = z.object({
  type:        z.string(),
  span:        z.string(),
  explanation: z.string(),
  confidence:  z.number().min(0).max(1),
});

// Reader-mode schema — no blind-spot field.
export const AnalysisResultSchema = z.object({
  toulmin:   ToulminAnalysisSchema,
  fallacies: z.array(FallacyFlagSchema),
  steelman:  z.string(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// Creator-mode extension — adds optional blind-spot counterarguments.
export const BlindSpotCounterargumentSchema = z.object({
  objection:      z.string(),
  why_it_matters: z.string(),
  confidence:     z.number().min(0).max(1),
});
export type BlindSpotCounterargument = z.infer<typeof BlindSpotCounterargumentSchema>;

export const CreatorAnalysisResultSchema = z.object({
  toulmin:                   ToulminAnalysisSchema,
  fallacies:                 z.array(FallacyFlagSchema),
  steelman:                  z.string(),
  blindSpotCounterarguments: z.array(BlindSpotCounterargumentSchema).optional(),
});
export type CreatorAnalysisResult = z.infer<typeof CreatorAnalysisResultSchema>;

export const TriageResultSchema = z.object({
  isArgument:     z.boolean(),
  topicDomain:    z.string().nullable(),
  roughWordCount: z.number(),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

export const ApiRequestSchema = z.object({
  text: z.string().min(1).max(50_000),
  mode: z.enum(['reader', 'creator']),
});
