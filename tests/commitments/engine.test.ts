import { describe, it, expect } from 'vitest';
import { detectCommitments } from '../../functions/_lib/philosophical-commitments/engine';
import { ProviderError } from '../../functions/_lib/providers/types';
import type { CommitmentsDeps } from '../../functions/_lib/philosophical-commitments/types';
import type { LlmProvider } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_RESULT_JSON = JSON.stringify({
  ethical: {
    framework:   'consequentialist',
    evidence:    'The draft justifies the policy by citing injury cost reduction for taxpayers.',
    explanation: 'Consequentialist reasoning treats aggregate welfare as the primary criterion for policy.',
    confidence:  80,
  },
  epistemic: {
    framework:   'empiricist',
    evidence:    'Appeals to a 2019 BMJ meta-analysis and Australian/New Zealand cycling studies.',
    explanation: 'The argument treats peer-reviewed empirical evidence as the authoritative ground for policy claims.',
    confidence:  85,
  },
  political:       null,
  methodological:  null,
  alternativePerspectives: [
    {
      framework:     'Deontological',
      frameworkType: 'ethical',
      objection:     'Mandatory helmet laws coerce individuals in a domain that primarily affects themselves.',
      specificity:   'The draft acknowledges the autonomy objection but responds with welfare aggregation, which a Kantian rejects.',
    },
  ],
  notes: null,
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

function makeDeps(provider: LlmProvider, overrides?: Partial<CommitmentsDeps>): CommitmentsDeps {
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

describe('detectCommitments', () => {
  it('returns parsed result on a successful response', async () => {
    const provider = makeProvider([
      async () => ({ content: MINIMAL_RESULT_JSON, inputTokens: 500, outputTokens: 200 }),
    ]);

    const { result, inputTokens, outputTokens } = await detectCommitments(
      'The case for mandatory helmet laws rests on injury data and economic arguments.',
      makeDeps(provider),
    );

    expect(result.ethical?.framework).toBe('consequentialist');
    expect(result.ethical?._debugConfidence).toBe(80);
    expect(result.ethical?.groundedness.kind).toBe('interpretive');
    expect(result.epistemic?.framework).toBe('empiricist');
    expect(result.political).toBeNull();
    expect(result.methodological).toBeNull();
    expect(result.alternativePerspectives).toHaveLength(1);
    expect(result.alternativePerspectives[0]!.frameworkType).toBe('ethical');
    expect(inputTokens).toBe(500);
    expect(outputTokens).toBe(200);
  });

  it('retries once on invalid JSON', async () => {
    let callCount = 0;
    const provider = makeProvider([
      async () => { callCount++; return { content: 'not-json', inputTokens: 5, outputTokens: 2 }; },
      async () => { callCount++; return { content: MINIMAL_RESULT_JSON, inputTokens: 500, outputTokens: 200 }; },
    ]);

    const { result } = await detectCommitments('Some text.', makeDeps(provider));
    expect(result.ethical?.framework).toBe('consequentialist');
    expect(callCount).toBe(2);
  });

  it('throws after two consecutive invalid JSON responses', async () => {
    const provider = makeProvider([
      async () => ({ content: '{"wrong": true}', inputTokens: 5, outputTokens: 2 }),
      async () => ({ content: '{"also_wrong": true}', inputTokens: 5, outputTokens: 2 }),
    ]);

    await expect(
      detectCommitments('Some text.', makeDeps(provider)),
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
        return { content: MINIMAL_RESULT_JSON, inputTokens: 500, outputTokens: 200 };
      },
    };

    const { result } = await detectCommitments('Some text.', makeDeps(provider));
    expect(result.ethical?.framework).toBe('consequentialist');
    expect(callCount).toBe(3);
  });

  it('throws immediately on a non-retryable provider error', async () => {
    const blocked = new ProviderError('provider_error', 'API key invalid', 401, false);
    const provider: LlmProvider = {
      name:     'mock',
      complete: async () => { throw blocked; },
    };

    await expect(
      detectCommitments('Some text.', makeDeps(provider)),
    ).rejects.toThrow('API key invalid');
  });
});
