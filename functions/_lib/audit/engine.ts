import { callWithRetry } from '../llm/retry';
import { AuditResultSchema, AuditInputSchema } from './schemas';
import { buildSystemPrompt, buildAuditPrompt } from './prompts';
import { AUDIT_MODEL, AUDIT_THINKING_BUDGET, AUDIT_TEMPERATURE, AUDIT_MAX_TOKENS } from './constants';
import type { AuditResult, AuditDeps } from './types';

// ---------------------------------------------------------------------------
// Post-validation: every quoted / verbatim string must appear in the input.
// Called after schema validation so we know the shape is already correct.
// ---------------------------------------------------------------------------

export function validateQuotesInText(audit: AuditResult, inputText: string): void {
  const violations: string[] = [];

  for (const fallacy of audit.namedFallacies) {
    if (!inputText.includes(fallacy.quote)) {
      violations.push(`namedFallacies[${fallacy.name}].quote: "${fallacy.quote.slice(0, 60)}…"`);
    }
  }

  for (const item of audit.loadedLanguage) {
    if (!inputText.includes(item.phrase)) {
      violations.push(`loadedLanguage[${item.technique}].phrase: "${item.phrase.slice(0, 60)}…"`);
    }
  }

  for (const finding of audit.keyTermScrutiny) {
    if (!inputText.includes(finding.usage_a)) {
      violations.push(`keyTermScrutiny[${finding.term}].usage_a: "${finding.usage_a.slice(0, 60)}…"`);
    }
    if (!inputText.includes(finding.usage_b)) {
      violations.push(`keyTermScrutiny[${finding.term}].usage_b: "${finding.usage_b.slice(0, 60)}…"`);
    }
  }

  for (const finding of audit.referentChecks) {
    if (!inputText.includes(finding.evidence)) {
      violations.push(`referentChecks[${finding.phrase}].evidence: "${finding.evidence.slice(0, 60)}…"`);
    }
  }

  for (const finding of audit.falsifiabilityChecks) {
    if (!inputText.includes(finding.evidence)) {
      violations.push(`falsifiabilityChecks[${finding.claim.slice(0, 30)}].evidence: "${finding.evidence.slice(0, 60)}…"`);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Audit quote validation failed — the following are not verbatim substrings of the input:\n` +
      violations.join('\n'),
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

  const includePhase2    = deps.includePhase2 ?? false;
  const systemInstruction = buildSystemPrompt(includePhase2);

  const { output, inputTokens, outputTokens } = await callWithRetry(
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
          thinkingBudget:    AUDIT_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    AuditResultSchema,
    'audit',
    deps.backoffDelaysMs,
  );

  validateQuotesInText(output, text);

  return { audit: output, inputTokens, outputTokens };
}
