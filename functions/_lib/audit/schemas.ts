import { z } from 'zod';
import { FALLACY_NAMES, LOADED_LANGUAGE_TECHNIQUES } from './taxonomy';
import { GroundednessSignalSchema } from '../grounded/schemas';

// ---------------------------------------------------------------------------
// Schemas come in two flavours:
//
//   Raw* — what the LLM emits. Includes `confidence: number`. Used inside the
//          engine to validate model output before transforming.
//   *    — canonical, what the engine emits and the API returns. Uses
//          `groundedness: GroundednessSignal` and an optional internal
//          `_debugConfidence` (NOT shown to users).
// ---------------------------------------------------------------------------

const severityField        = z.enum(['high', 'medium', 'low']);
const confidenceField      = z.number().int().min(0).max(100);
const groundednessField    = GroundednessSignalSchema;
const debugConfidenceField = confidenceField.optional();

// --- Raw model-output schemas ------------------------------------------------

export const RawUnstatedWarrantSchema = z.object({
  warrant:    z.string().min(1),
  necessity:  z.string().min(1),
  severity:   severityField,
  confidence: confidenceField,
});

export const RawNamedFallacySchema = z.object({
  name:        z.enum(FALLACY_NAMES),
  quote:       z.string().min(1),
  explanation: z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

export const RawLoadedLanguageSchema = z.object({
  phrase:      z.string().min(1),
  technique:   z.enum(LOADED_LANGUAGE_TECHNIQUES),
  explanation: z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

const KEY_TERM_ISSUES        = ['stipulative-smuggling','cross-language-game-equivocation','family-resemblance-overreach'] as const;
const REFERENT_ISSUES        = ['empty-referent','vague-proper-name','failed-presupposition'] as const;
const FALSIFIABILITY_ISSUES  = ['no-truth-conditions','circular-truth-conditions','unfalsifiable-dressed-as-substantive'] as const;
const MODAL_SCOPE_ISSUES     = ['necessity-overstated','possibility-treated-as-fact','contingency-obscured','hedge-stripped-in-conclusion'] as const;

export const RawKeyTermScrutinyFindingSchema = z.object({
  term:        z.string().min(1),
  usage_a:     z.string().min(1),
  usage_b:     z.string().min(1),
  issue:       z.enum(KEY_TERM_ISSUES),
  explanation: z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

export const RawReferentCheckFindingSchema = z.object({
  phrase:      z.string().min(1),
  issue:       z.enum(REFERENT_ISSUES),
  explanation: z.string().min(1),
  evidence:    z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

export const RawFalsifiabilityFindingSchema = z.object({
  claim:       z.string().min(1),
  issue:       z.enum(FALSIFIABILITY_ISSUES),
  explanation: z.string().min(1),
  evidence:    z.string().min(1),
  severity:    severityField,
  confidence:  confidenceField,
});

export const RawModalScopeCheckFindingSchema = z.object({
  claim:         z.string().min(1),
  inflatedModal: z.string().min(1),
  impliedModal:  z.string().min(1),
  issue:         z.enum(MODAL_SCOPE_ISSUES),
  explanation:   z.string().min(1),
  evidence:      z.string().min(1),
  severity:      severityField,
  confidence:    confidenceField,
});

export const RawToulminAnalysisSchema = z.object({
  claim:            z.string().min(1),
  grounds:          z.string().min(1),
  statedWarrant:    z.string().nullable(),
  unstatedWarrants: z.array(RawUnstatedWarrantSchema),
  weakestLink:      z.string().min(1),
});

export const RawAuditResultSchema = z.object({
  centralClaim:         z.string().min(1),
  toulmin:              RawToulminAnalysisSchema,
  namedFallacies:       z.array(RawNamedFallacySchema),
  loadedLanguage:       z.array(RawLoadedLanguageSchema),
  notes:                z.string().nullable(),
  keyTermScrutiny:      z.array(RawKeyTermScrutinyFindingSchema).default([]),
  referentChecks:       z.array(RawReferentCheckFindingSchema).default([]),
  falsifiabilityChecks: z.array(RawFalsifiabilityFindingSchema).default([]),
  modalScopeChecks:     z.array(RawModalScopeCheckFindingSchema).default([]),
});

// --- Canonical (grounded) schemas -- used by the API + storage --------------

export const UnstatedWarrantSchema = z.object({
  warrant:           z.string().min(1),
  necessity:         z.string().min(1),
  severity:          severityField,
  groundedness:      groundednessField,
  _debugConfidence:  debugConfidenceField,
});

export const ToulminAnalysisSchema = z.object({
  claim:            z.string().min(1),
  grounds:          z.string().min(1),
  statedWarrant:    z.string().nullable(),
  unstatedWarrants: z.array(UnstatedWarrantSchema),
  weakestLink:      z.string().min(1),
});

export const NamedFallacySchema = z.object({
  name:              z.enum(FALLACY_NAMES),
  quote:             z.string().min(1),
  explanation:       z.string().min(1),
  severity:          severityField,
  groundedness:      groundednessField,
  _debugConfidence:  debugConfidenceField,
});

export const LoadedLanguageSchema = z.object({
  phrase:            z.string().min(1),
  technique:         z.enum(LOADED_LANGUAGE_TECHNIQUES),
  explanation:       z.string().min(1),
  severity:          severityField,
  groundedness:      groundednessField,
  _debugConfidence:  debugConfidenceField,
});

export const KeyTermScrutinyFindingSchema = z.object({
  term:              z.string().min(1),
  usage_a:           z.string().min(1),
  usage_b:           z.string().min(1),
  issue:             z.enum(KEY_TERM_ISSUES),
  explanation:       z.string().min(1),
  severity:          severityField,
  groundedness:      groundednessField,
  _debugConfidence:  debugConfidenceField,
});

export const ReferentCheckFindingSchema = z.object({
  phrase:            z.string().min(1),
  issue:             z.enum(REFERENT_ISSUES),
  explanation:       z.string().min(1),
  evidence:          z.string().min(1),
  severity:          severityField,
  groundedness:      groundednessField,
  _debugConfidence:  debugConfidenceField,
});

export const FalsifiabilityFindingSchema = z.object({
  claim:             z.string().min(1),
  issue:             z.enum(FALSIFIABILITY_ISSUES),
  explanation:       z.string().min(1),
  evidence:          z.string().min(1),
  severity:          severityField,
  groundedness:      groundednessField,
  _debugConfidence:  debugConfidenceField,
});

export const ModalScopeCheckFindingSchema = z.object({
  claim:             z.string().min(1),
  inflatedModal:     z.string().min(1),
  impliedModal:      z.string().min(1),
  issue:             z.enum(MODAL_SCOPE_ISSUES),
  explanation:       z.string().min(1),
  evidence:          z.string().min(1),
  severity:          severityField,
  groundedness:      groundednessField,
  _debugConfidence:  debugConfidenceField,
});

export const AuditResultSchema = z.object({
  centralClaim:         z.string().min(1),
  toulmin:              ToulminAnalysisSchema,
  namedFallacies:       z.array(NamedFallacySchema),
  loadedLanguage:       z.array(LoadedLanguageSchema),
  notes:                z.string().nullable(),
  keyTermScrutiny:      z.array(KeyTermScrutinyFindingSchema).default([]),
  referentChecks:       z.array(ReferentCheckFindingSchema).default([]),
  falsifiabilityChecks: z.array(FalsifiabilityFindingSchema).default([]),
  modalScopeChecks:     z.array(ModalScopeCheckFindingSchema).default([]),
});

export const AuditInputSchema = z.object({
  text: z.string().min(1),
});
