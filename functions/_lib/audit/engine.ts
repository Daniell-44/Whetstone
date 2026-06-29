import type { z } from 'zod';
import { callWithRetry } from '../llm/retry';
import { RawAuditResultSchema, AuditInputSchema } from './schemas';
import { buildSystemPrompt, buildAuditPrompt } from './prompts';
import { buildGoalsPreamble } from './goals';
import { AUDIT_MODEL, AUDIT_THINKING_BUDGET, AUDIT_READER_THINKING_BUDGET, AUDIT_TEMPERATURE, AUDIT_MAX_TOKENS } from './constants';
import type { AuditResult, AuditDeps } from './types';
import { structural, bandFromLegacyConfidence, interpretive } from '../grounded/types';
import type { GroundednessSignal } from '../grounded/types';

// ---------------------------------------------------------------------------
// Two shapes:
//   - RawAuditResult: what the schema validates (model still emits `confidence`).
//   - AuditResult   : what the engine returns (`groundedness` + optional
//                     `_debugConfidence` preserved for calibration).
//
// `applyGroundedness` is the transform. Audit findings are all structural —
// the model's emitted confidence number is irrelevant for kind assignment.
// We preserve it as `_debugConfidence` so calibration work can still inspect.
// ---------------------------------------------------------------------------

type RawAuditResult = z.infer<typeof RawAuditResultSchema>;

function injectStructural<T extends { confidence?: number }>(
  raw: T,
): Omit<T, 'confidence'> & { groundedness: GroundednessSignal; _debugConfidence?: number } {
  const { confidence, ...rest } = raw;
  return {
    ...(rest as Omit<T, 'confidence'>),
    groundedness:      structural(),
    _debugConfidence:  confidence,
  };
}

function applyGroundedness(raw: RawAuditResult): AuditResult {
  return {
    centralClaim: raw.centralClaim,
    toulmin: {
      ...raw.toulmin,
      unstatedWarrants: raw.toulmin.unstatedWarrants.map(injectStructural),
    },
    namedFallacies:       raw.namedFallacies.map(injectStructural),
    loadedLanguage:       raw.loadedLanguage.map(injectStructural),
    notes:                raw.notes,
    keyTermScrutiny:      raw.keyTermScrutiny.map(injectStructural),
    referentChecks:       raw.referentChecks.map(injectStructural),
    falsifiabilityChecks: raw.falsifiabilityChecks.map(injectStructural),
    modalScopeChecks:     raw.modalScopeChecks.map(injectStructural),
  };
}

// ---------------------------------------------------------------------------
// Post-validation: every quoted / verbatim string must appear in the input.
// Drop-and-continue: rather than failing the entire audit when one finding
// has a non-verbatim quote, we strip the offending findings and return the
// remainder. Violations are logged so calibration work can address frequent
// offenders.
// ---------------------------------------------------------------------------

export interface ValidationReport {
  audit:    AuditResult;
  dropped:  string[];
}

// Verbatim modulo typography: unify smart quotes/dashes and collapse
// whitespace (preserve case) so a finding isn't dropped merely because the
// model emitted a straight apostrophe where the source has a curly one, or
// normalised a line break to a space. A genuine paraphrase (different words)
// still fails — this only tolerates typographic drift, not rewording.
function normVerbatim(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterValidQuotes(audit: AuditResult, inputText: string): ValidationReport {
  const dropped: string[] = [];
  const ni = normVerbatim(inputText);
  const has = (s: string): boolean => ni.includes(normVerbatim(s));

  const namedFallacies = audit.namedFallacies.filter((f) => {
    if (has(f.quote)) return true;
    dropped.push(`namedFallacies[${f.name}]`);
    return false;
  });

  const loadedLanguage = audit.loadedLanguage.filter((l) => {
    if (has(l.phrase)) return true;
    dropped.push(`loadedLanguage[${l.technique}]`);
    return false;
  });

  const keyTermScrutiny = audit.keyTermScrutiny.filter((k) => {
    if (has(k.usage_a) && has(k.usage_b)) return true;
    dropped.push(`keyTermScrutiny[${k.term}]`);
    return false;
  });

  const referentChecks = audit.referentChecks.filter((r) => {
    if (has(r.evidence)) return true;
    dropped.push(`referentChecks[${r.phrase}]`);
    return false;
  });

  const falsifiabilityChecks = audit.falsifiabilityChecks.filter((f) => {
    if (has(f.evidence)) return true;
    dropped.push(`falsifiabilityChecks[${f.claim.slice(0, 30)}]`);
    return false;
  });

  const modalScopeChecks = audit.modalScopeChecks.filter((m) => {
    if (has(m.evidence)) return true;
    dropped.push(`modalScopeChecks[${m.claim.slice(0, 30)}]`);
    return false;
  });

  return {
    audit: {
      ...audit,
      namedFallacies,
      loadedLanguage,
      keyTermScrutiny,
      referentChecks,
      falsifiabilityChecks,
      modalScopeChecks,
    },
    dropped,
  };
}

export function validateQuotesInText(audit: AuditResult, inputText: string): void {
  const { dropped } = filterValidQuotes(audit, inputText);
  if (dropped.length > 0) {
    throw new Error(
      `Audit quote validation failed — the following are not verbatim substrings of the input:\n` +
      dropped.join('\n'),
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AuditTextResult {
  audit:        AuditResult;
  inputTokens:  number;
  outputTokens: number;
}

export async function auditText(
  text: string,
  deps: AuditDeps,
): Promise<AuditTextResult> {
  const validated = AuditInputSchema.safeParse({ text });
  if (!validated.success) {
    throw new Error(`Invalid AuditInput: ${validated.error.message}`);
  }

  const includePhase2     = deps.includePhase2 ?? false;
  const goalsPreamble     = deps.goals ? buildGoalsPreamble(deps.goals) : undefined;
  // Production default: the `precision` package (impartiality + soundness gate +
  // critical-questions). The 2026-06-29 decomposed eval (3 rounds x 22 fixtures)
  // showed this combination — and ONLY this combination — eliminates
  // over-detection: P/R/F1 = 1.00, 0 false positives, ECE ~= 0.046, with zero
  // round-to-round variance. No single flag holds the gain alone (each ~= control
  // and wobbles). reasoningFirst stays off (the model already has a thinking
  // budget). All three are pure prompt instructions — no extra API pass. Callers
  // (e.g. the detection eval) may still override any flag explicitly.
  const systemInstruction = buildSystemPrompt(includePhase2, goalsPreamble, {
    impartiality:      deps.promptVariant?.impartiality ?? true,
    reasoningFirst:    deps.promptVariant?.reasoningFirst ?? false,
    soundnessGate:     deps.promptVariant?.soundnessGate ?? true,
    criticalQuestions: deps.promptVariant?.criticalQuestions ?? true,
  });

  const { output: rawOutput, inputTokens, outputTokens } = await callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.model ?? AUDIT_MODEL,
          systemInstruction,
          messages:          [{ role: 'user', content: buildAuditPrompt(text) }],
          responseFormat:    'json',
          temperature:       AUDIT_TEMPERATURE,
          maxTokens:         AUDIT_MAX_TOKENS,
          thinkingBudget:    includePhase2 ? AUDIT_THINKING_BUDGET : AUDIT_READER_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    RawAuditResultSchema,
    'audit',
    deps.backoffDelaysMs,
  );

  const grounded = applyGroundedness(rawOutput);
  const { audit: filtered, dropped } = filterValidQuotes(grounded, text);
  if (dropped.length > 0) {
    console.warn(`[audit] dropped ${dropped.length} finding(s) with non-verbatim quotes:`, dropped.join(', '));
  }

  return { audit: filtered, inputTokens, outputTokens };
}

// Silence the unused-import warning — interpretive/bandFromLegacyConfidence are
// kept for the upcoming prompt update that will let the model directly emit
// a kind label.
export { interpretive, bandFromLegacyConfidence };
