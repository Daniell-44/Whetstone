import { z } from 'zod';
import { FALLACY_NAMES, LOADED_LANGUAGE_TECHNIQUES } from './taxonomy';

const confidenceField = z.number().int().min(0).max(100);
const severityField   = z.enum(['high', 'medium', 'low']);

export const UnstatedWarrantSchema = z.object({
  warrant:    z.string().min(1),
  necessity:  z.string().min(1),
  severity:   severityField,
  confidence: confidenceField,
});

export const ToulminAnalysisSchema = z.object({
  claim:            z.string().min(1),
  grounds:          z.string().min(1),
  statedWarrant:    z.string().nullable(),
  unstatedWarrants: z.array(UnstatedWarrantSchema),
  weakestLink:      z.string().min(1),
});

export const NamedFallacySchema = z.object({
  name:        z.enum(FALLACY_NAMES),
  quote:       z.string().min(1),
  explanation: z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

export const LoadedLanguageSchema = z.object({
  phrase:      z.string().min(1),
  technique:   z.enum(LOADED_LANGUAGE_TECHNIQUES),
  explanation: z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

// ---------------------------------------------------------------------------
// Phase-2 schemas
// ---------------------------------------------------------------------------

const KEY_TERM_ISSUES = [
  'stipulative-smuggling',
  'cross-language-game-equivocation',
  'family-resemblance-overreach',
] as const;

const REFERENT_ISSUES = [
  'empty-referent',
  'vague-proper-name',
  'failed-presupposition',
] as const;

const FALSIFIABILITY_ISSUES = [
  'no-truth-conditions',
  'circular-truth-conditions',
  'unfalsifiable-dressed-as-substantive',
] as const;

export const KeyTermScrutinyFindingSchema = z.object({
  term:        z.string().min(1),
  usage_a:     z.string().min(1),
  usage_b:     z.string().min(1),
  issue:       z.enum(KEY_TERM_ISSUES),
  explanation: z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

export const ReferentCheckFindingSchema = z.object({
  phrase:      z.string().min(1),
  issue:       z.enum(REFERENT_ISSUES),
  explanation: z.string().min(1),
  evidence:    z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

export const FalsifiabilityFindingSchema = z.object({
  claim:       z.string().min(1),
  issue:       z.enum(FALSIFIABILITY_ISSUES),
  explanation: z.string().min(1),
  evidence:    z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

// ---------------------------------------------------------------------------
// Root schema — Phase-2 arrays default to [] so anonymous audits pass
// ---------------------------------------------------------------------------

export const AuditResultSchema = z.object({
  centralClaim:         z.string().min(1),
  toulmin:              ToulminAnalysisSchema,
  namedFallacies:       z.array(NamedFallacySchema),
  loadedLanguage:       z.array(LoadedLanguageSchema),
  notes:                z.string().nullable(),
  keyTermScrutiny:      z.array(KeyTermScrutinyFindingSchema).default([]),
  referentChecks:       z.array(ReferentCheckFindingSchema).default([]),
  falsifiabilityChecks: z.array(FalsifiabilityFindingSchema).default([]),
});

export const AuditInputSchema = z.object({
  text: z.string().min(1),
});
