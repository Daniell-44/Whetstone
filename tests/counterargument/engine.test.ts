import { describe, it, expect } from 'vitest';
import { generateCounterarguments } from '../../functions/_lib/counterargument/engine';
import { ProviderError } from '../../functions/_lib/providers/types';
import type { CounterargDeps } from '../../functions/_lib/counterargument/types';
import type { LlmProvider } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_RESULT_JSON = JSON.stringify({
  centralClaim: 'Chronological feeds are ethically superior to algorithmic ones.',
  counterarguments: [
    {
      position:      'Chronological feeds advantage high-frequency institutional posters over individual creators.',
      strongestCase: {
        claim:   'Mandating chronological order substitutes one form of algorithmic power for another.',
        grounds: 'Media outlets post dozens of times daily; individuals post once or twice.',
        warrant: 'Frequency-optimised visibility is no more neutral than engagement-optimised visibility.',
      },
      missedByDraft: 'The draft does not address what chronological ordering does at the scale of millions of accounts.',
      why:           'This argument accepts the diagnosis while rejecting the prescription, which is the hardest form of opposition to dismiss.',
    },
    {
      position:      'The harms of social media are rooted in advertising incentives, not feed mechanics.',
      strongestCase: {
        claim:   'Changing the feed algorithm leaves the underlying incentive structure intact.',
        grounds: 'Platform revenue depends on maximising time-on-site; chronological feeds do not eliminate this incentive.',
        warrant: 'A regulatory fix that does not address the root incentive will be circumvented through other product mechanisms.',
      },
      missedByDraft: 'The draft argues against engagement algorithms but does not address whether the advertising model would simply adapt.',
      why:           'This forces the draft to either defend a far more radical intervention or concede that chronological feeds are insufficient.',
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

function makeDeps(provider: LlmProvider, overrides?: Partial<CounterargDeps>): CounterargDeps {
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

describe('generateCounterarguments', () => {
  it('returns a parsed result on a successful response', async () => {
    const provider = makeProvider([
      async () => ({ content: MINIMAL_RESULT_JSON, inputTokens: 200, outputTokens: 100 }),
    ]);

    const { result, inputTokens, outputTokens } = await generateCounterarguments(
      'A long argumentative text about social media.',
      makeDeps(provider),
    );

    expect(result.centralClaim).toBe('Chronological feeds are ethically superior to algorithmic ones.');
    expect(result.counterarguments).toHaveLength(2);
    expect(result.notes).toBeNull();
    expect(inputTokens).toBe(200);
    expect(outputTokens).toBe(100);
  });

  it('retries once immediately on invalid JSON from the model', async () => {
    let callCount = 0;
    const provider = makeProvider([
      async () => { callCount++; return { content: 'not json', inputTokens: 5, outputTokens: 2 }; },
      async () => { callCount++; return { content: MINIMAL_RESULT_JSON, inputTokens: 200, outputTokens: 100 }; },
    ]);

    const { result } = await generateCounterarguments('Some text.', makeDeps(provider));
    expect(result.counterarguments).toHaveLength(2);
    expect(callCount).toBe(2);
  });

  it('throws after two consecutive invalid JSON responses', async () => {
    const provider = makeProvider([
      async () => ({ content: '{"wrong": true}', inputTokens: 5, outputTokens: 2 }),
      async () => ({ content: '{"also_wrong": true}', inputTokens: 5, outputTokens: 2 }),
    ]);

    await expect(
      generateCounterarguments('Some text.', makeDeps(provider)),
    ).rejects.toThrow(/failed JSON validation after 2 attempts/);
  });

  it('rejects output with fewer than 2 counterarguments', async () => {
    const tooFew = JSON.stringify({
      centralClaim:     'Test claim.',
      counterarguments: [
        {
          position:      'Only one counterargument.',
          strongestCase: { claim: 'c', grounds: 'g', warrant: 'w' },
          missedByDraft: 'm',
          why:           'y',
        },
      ],
      notes: null,
    });
    const provider = makeProvider([
      async () => ({ content: tooFew, inputTokens: 10, outputTokens: 5 }),
      async () => ({ content: tooFew, inputTokens: 10, outputTokens: 5 }),
    ]);

    await expect(
      generateCounterarguments('Some text.', makeDeps(provider)),
    ).rejects.toThrow(/failed JSON validation/);
  });

  it('rejects output with more than 3 counterarguments', async () => {
    const single = {
      position:      'Position.',
      strongestCase: { claim: 'c', grounds: 'g', warrant: 'w' },
      missedByDraft: 'm',
      why:           'y',
    };
    const tooMany = JSON.stringify({
      centralClaim:     'Test claim.',
      counterarguments: [single, single, single, single],
      notes:            null,
    });
    const provider = makeProvider([
      async () => ({ content: tooMany, inputTokens: 10, outputTokens: 5 }),
      async () => ({ content: tooMany, inputTokens: 10, outputTokens: 5 }),
    ]);

    await expect(
      generateCounterarguments('Some text.', makeDeps(provider)),
    ).rejects.toThrow(/failed JSON validation/);
  });

  it('backs off and retries on a retryable provider error', async () => {
    const overload = new ProviderError('provider_error', 'Overloaded', 529, true);
    let callCount  = 0;
    const provider: LlmProvider = {
      name:     'mock',
      complete: async () => {
        callCount++;
        if (callCount < 3) throw overload;
        return { content: MINIMAL_RESULT_JSON, inputTokens: 200, outputTokens: 100 };
      },
    };

    const { result } = await generateCounterarguments('Some text.', makeDeps(provider));
    expect(result.counterarguments).toHaveLength(2);
    expect(callCount).toBe(3);
  });

  it('accepts exactly 3 counterarguments', async () => {
    const single = {
      position:      'Position.',
      strongestCase: { claim: 'c', grounds: 'g', warrant: 'w' },
      missedByDraft: 'm',
      why:           'y',
    };
    const threeItems = JSON.stringify({
      centralClaim:     'Test claim.',
      counterarguments: [single, single, single],
      notes:            'Some notes.',
    });
    const provider = makeProvider([
      async () => ({ content: threeItems, inputTokens: 20, outputTokens: 10 }),
    ]);

    const { result } = await generateCounterarguments('Some text.', makeDeps(provider));
    expect(result.counterarguments).toHaveLength(3);
    expect(result.notes).toBe('Some notes.');
  });
});
