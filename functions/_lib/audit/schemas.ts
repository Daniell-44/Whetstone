import { z } from 'zod';
import { FALLACY_NAMES, LOADED_LANGUAGE_TECHNIQUES } from './taxonomy';

export const UnstatedWarrantSchema = z.object({
  warrant:   z.string().min(1),
  necessity: z.string().min(1),
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
  severity:    z.enum(['high', 'medium', 'low']),
});

export const LoadedLanguageSchema = z.object({
  phrase:      z.string().min(1),
  technique:   z.enum(LOADED_LANGUAGE_TECHNIQUES),
  explanation: z.string().min(1),
});

export const AuditResultSchema = z.object({
  centralClaim:   z.string().min(1),
  toulmin:        ToulminAnalysisSchema,
  namedFallacies: z.array(NamedFallacySchema),
  loadedLanguage: z.array(LoadedLanguageSchema),
  notes:          z.string().nullable(),
});

export const AuditInputSchema = z.object({
  text: z.string().min(1),
});
