import { describe, it, expect } from 'vitest';
import { extractArgument } from '../../functions/_lib/argument-extraction/engine';
import { ProviderError } from '../../functions/_lib/providers/types';
import type { ExtractionDeps } from '../../functions/_lib/argument-extraction/types';
import type { LlmProvider } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_RESULT_JSON = JSON.stringify({
  centralClaim: 'Regulatory intervention in social media is justified.',
  statements: [
    {
      id:   'P1',
      type: 'premise',
      text: 'Social media platforms optimise for engagement over accuracy.',
    },
    {
      id:            'C1',
      type:          'conclusion',
      text:          'Regulatory intervention is justified.',
      derivedFrom:   ['P1'],
      inferenceRule: 'modus_ponens',
      inferenceRuleExplanation: 'If optimising for engagement causes epistemic harm, intervention is warranted; P1 supplies the antecedent.',
    },
  ],
  notes:      null,
  confidence: 87,
});

const EMPTY_RESULT_JSON = JSON.stringify({
  centralClaim: '(no argument)',
  statements:   [],
  notes:        'The text does not advance a conclusion from premises.',
  confidence:   100,
});

function makeProvider(
  responses: Array<() => Promise<{ content: string; inputTokens: number; outputTokens: number }>>,
): LlmProvider {
  let call = 0;
  return {
    name:     'mock',
    complete: () => responses[call++]!(),
  };
}

function makeDeps(provider: LlmProvider, overrides?: Partial<ExtractionDeps>): ExtractionDeps {
  return {
    provider,
    apiKey:          'test-key',
    backoffDelaysMs: [1, 1, 1],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractArgument', () => {
  it('returns parsed result on a successful response', async () => {
    const provider = makeProvider([
      async () => ({ content: MINIMAL_RESULT_JSON, inputTokens: 150, outputTokens: 80 }),
    ]);

    const { result, inputTokens, outputTokens } = await extractArgument(
      'Social media text about engagement and epistemic harms.',
      makeDeps(provider),
    );

    expect(result.centralClaim).toBe('Regulatory intervention in social media is justified.');
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0]!.type).toBe('premise');
    expect(result.statements[1]!.type).toBe('conclusion');
    expect(result.statements[1]!.inferenceRule).toBe('modus_ponens');
    expect(result.confidence).toBe(87);
    expect(inputTokens).toBe(150);
    expect(outputTokens).toBe(80);
  });

  it('accepts the empty no-argument case', async () => {
    const provider = makeProvider([
      async () => ({ content: EMPTY_RESULT_JSON, inputTokens: 50, outputTokens: 20 }),
    ]);

    const { result } = await extractArgument('Just a descriptive paragraph.', makeDeps(provider));
    expect(result.centralClaim).toBe('(no argument)');
    expect(result.statements).toHaveLength(0);
    expect(result.confidence).toBe(100);
  });

  it('retries once on invalid JSON', async () => {
    let callCount = 0;
    const provider = makeProvider([
      async () => { callCount++; return { content: 'not-json', inputTokens: 5, outputTokens: 2 }; },
      async () => { callCount++; return { content: MINIMAL_RESULT_JSON, inputTokens: 150, outputTokens: 80 }; },
    ]);

    const { result } = await extractArgument('Some text.', makeDeps(provider));
    expect(result.statements).toHaveLength(2);
    expect(callCount).toBe(2);
  });

  it('throws after two consecutive invalid JSON responses', async () => {
    const provider = makeProvider([
      async () => ({ content: '{"wrong": true}', inputTokens: 5, outputTokens: 2 }),
      async () => ({ content: '{"also_wrong": true}', inputTokens: 5, outputTokens: 2 }),
    ]);

    await expect(
      extractArgument('Some text.', makeDeps(provider)),
    ).rejects.toThrow(/failed JSON validation after 2 attempts/);
  });

  it('backs off and retries on a retryable provider error', async () => {
    const overload = new ProviderError('provider_error', 'Overloaded', 529, true);
    let callCount  = 0;
    const provider: LlmProvider = {
      name:     'mock',
      complete: async () => {
        callCount++;
        if (callCount < 3) throw overload;
        return { content: MINIMAL_RESULT_JSON, inputTokens: 150, outputTokens: 80 };
      },
    };

    const { result } = await extractArgument('Some text.', makeDeps(provider));
    expect(result.statements).toHaveLength(2);
    expect(callCount).toBe(3);
  });

  it('throws immediately on a non-retryable provider error', async () => {
    const blocked = new ProviderError('provider_error', 'API key invalid', 401, false);
    const provider: LlmProvider = {
      name:     'mock',
      complete: async () => { throw blocked; },
    };

    await expect(
      extractArgument('Some text.', makeDeps(provider)),
    ).rejects.toThrow('API key invalid');
  });
});
