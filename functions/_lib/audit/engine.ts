import { callWithRetry } from '../llm/retry';
import { AuditResultSchema, AuditInputSchema } from './schemas';
import { AUDIT_SYSTEM_PROMPT, buildAuditPrompt } from './prompts';
import { AUDIT_MODEL, AUDIT_THINKING_BUDGET, AUDIT_TEMPERATURE, AUDIT_MAX_TOKENS } from './constants';
import type { AuditResult, AuditDeps } from './types';

// ---------------------------------------------------------------------------
// Post-validation: every quoted string must appear verbatim in the input text.
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

  const { output, inputTokens, outputTokens } = await callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.model ?? AUDIT_MODEL,
          systemInstruction: AUDIT_SYSTEM_PROMPT,
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
