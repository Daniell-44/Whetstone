import { describe, it, expect } from 'vitest';
import { auditText, validateQuotesInText } from '../../functions/_lib/audit/engine';
import { ProviderError } from '../../functions/_lib/providers/types';
import type { AuditDeps } from '../../functions/_lib/audit/types';
import type { LlmProvider } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_AUDIT_JSON = JSON.stringify({
  centralClaim:   'Helmets save lives.',
  toulmin: {
    claim:            'Cyclists should wear helmets.',
    grounds:          'Helmets reduce head injury risk by 60%.',
    statedWarrant:    null,
    unstatedWarrants: [
      { warrant: 'Reducing injury risk is a good reason for policy.', necessity: 'Connects evidence to conclusion.', severity: 'medium', confidence: 80 },
    ],
    weakestLink: 'The grounds come from a single meta-analysis.',
  },
  namedFallacies: [],
  loadedLanguage: [],
  notes:          null,
});

function makeProvider(responses: Array<() => Promise<{ content: string; inputTokens: number; outputTokens: number }>>): LlmProvider {
  let call = 0;
  return {
    name: 'mock',
    complete: () => responses[call++]!(),
  };
}

function makeDeps(provider: LlmProvider, overrides?: Partial<AuditDeps>): AuditDeps {
  return {
    provider,
    apiKey: 'test-key',
    backoffDelaysMs: [1, 1, 1],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auditText', () => {
  it('returns parsed audit on a successful response', async () => {
    const provider = makeProvider([
      async () => ({ content: MINIMAL_AUDIT_JSON, inputTokens: 100, outputTokens: 50 }),
    ]);

    const result = await auditText('Cyclists should wear helmets because helmets reduce head injury risk by 60%.', makeDeps(provider));

    expect(result.audit.centralClaim).toBe('Helmets save lives.');
    expect(result.audit.namedFallacies).toHaveLength(0);
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
  });

  it('retries once immediately on invalid JSON from the model', async () => {
    const provider = makeProvider([
      async () => ({ content: 'not json at all', inputTokens: 10, outputTokens: 5 }),
      async () => ({ content: MINIMAL_AUDIT_JSON, inputTokens: 100, outputTokens: 50 }),
    ]);

    const result = await auditText('Cyclists should wear helmets because helmets reduce head injury risk by 60%.', makeDeps(provider));
    expect(result.audit.centralClaim).toBe('Helmets save lives.');
  });

  it('throws after two consecutive invalid JSON responses', async () => {
    const provider = makeProvider([
      async () => ({ content: '{"wrong": true}', inputTokens: 10, outputTokens: 5 }),
      async () => ({ content: '{"also_wrong": true}', inputTokens: 10, outputTokens: 5 }),
    ]);

    await expect(
      auditText('Some text.', makeDeps(provider)),
    ).rejects.toThrow(/failed JSON validation after 2 attempts/);
  });

  it('backs off and retries on a retryable provider error', async () => {
    const overloadError = new ProviderError('provider_error', 'Service overloaded', 529, true);
    let callCount = 0;
    const provider: LlmProvider = {
      name: 'mock',
      complete: async () => {
        callCount++;
        if (callCount < 3) throw overloadError;
        return { content: MINIMAL_AUDIT_JSON, inputTokens: 100, outputTokens: 50 };
      },
    };

    const result = await auditText('Cyclists should wear helmets because helmets reduce head injury risk by 60%.', makeDeps(provider));
    expect(result.audit.centralClaim).toBe('Helmets save lives.');
    expect(callCount).toBe(3);
  });

  it('fails fast on a non-retryable (4xx) provider error', async () => {
    const authError = new ProviderError('bad_request', 'Invalid API key', 401, false);
    const provider: LlmProvider = {
      name: 'mock',
      complete: async () => { throw authError; },
    };

    await expect(
      auditText('Some text.', makeDeps(provider)),
    ).rejects.toThrow('Invalid API key');
  });

  it('throws when all backoff attempts are exhausted', async () => {
    const overloadError = new ProviderError('provider_error', 'Still overloaded', 529, true);
    const provider: LlmProvider = {
      name: 'mock',
      complete: async () => { throw overloadError; },
    };

    await expect(
      auditText('Some text.', makeDeps(provider, { backoffDelaysMs: [1, 1, 1] })),
    ).rejects.toThrow(/failed after 4 attempts/);
  });

  it('rejects when a quote field is not a verbatim substring', async () => {
    const auditWithBadQuote = JSON.stringify({
      centralClaim:   'Helmets save lives.',
      toulmin: {
        claim:            'Cyclists should wear helmets.',
        grounds:          'Helmets reduce head injury risk.',
        statedWarrant:    null,
        unstatedWarrants: [],
        weakestLink:      'Grounds are weak.',
      },
      namedFallacies: [
        {
          name:        'Appeal to Authority',
          quote:       'This phrase does not appear in the input text at all',
          explanation: 'Example fallacy.',
          severity:    'medium',
          confidence:  75,
        },
      ],
      loadedLanguage: [],
      notes:          null,
    });

    const provider = makeProvider([
      async () => ({ content: auditWithBadQuote, inputTokens: 10, outputTokens: 5 }),
    ]);

    await expect(
      auditText('Cyclists should wear helmets.', makeDeps(provider)),
    ).rejects.toThrow(/quote validation failed/);
  });

  it('accepts an audit with empty findings arrays', async () => {
    const provider = makeProvider([
      async () => ({ content: MINIMAL_AUDIT_JSON, inputTokens: 20, outputTokens: 10 }),
    ]);

    const result = await auditText('Cyclists should wear helmets because helmets reduce head injury risk by 60%.', makeDeps(provider));
    expect(result.audit.namedFallacies).toHaveLength(0);
    expect(result.audit.loadedLanguage).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateQuotesInText unit tests
// ---------------------------------------------------------------------------

describe('validateQuotesInText', () => {
  const baseAudit = {
    centralClaim:   'Test.',
    toulmin: {
      claim:            'Test.',
      grounds:          'Test.',
      statedWarrant:    null,
      unstatedWarrants: [],
      weakestLink:      'Test.',
    },
    namedFallacies: [],
    loadedLanguage: [],
    notes:          null,
  };

  it('passes when all quotes are verbatim substrings', () => {
    const audit = {
      ...baseAudit,
      namedFallacies: [
        { name: 'Ad Hominem' as const, quote: 'hello world', explanation: 'x', severity: 'low' as const, confidence: 80 },
      ],
    };
    expect(() => validateQuotesInText(audit, 'say hello world today')).not.toThrow();
  });

  it('throws when a fallacy quote is absent', () => {
    const audit = {
      ...baseAudit,
      namedFallacies: [
        { name: 'Ad Hominem' as const, quote: 'not present', explanation: 'x', severity: 'low' as const, confidence: 80 },
      ],
    };
    expect(() => validateQuotesInText(audit, 'completely different text')).toThrow(/quote validation failed/);
  });

  it('throws when a loaded-language phrase is absent', () => {
    const audit = {
      ...baseAudit,
      loadedLanguage: [
        { phrase: 'missing phrase', technique: 'Weasel words' as const, explanation: 'x', severity: 'low' as const, confidence: 70 },
      ],
    };
    expect(() => validateQuotesInText(audit, 'some other text')).toThrow(/quote validation failed/);
  });
});
