import { describe, it, expect } from 'vitest';
import { handleCommitmentsRequest } from '../../functions/_lib/philosophical-commitments/handler';
import type { CommitmentsHandlerDeps } from '../../functions/_lib/philosophical-commitments/handler';
import type { LlmProvider } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_RESULT_JSON = JSON.stringify({
  ethical:         { framework: 'consequentialist', evidence: 'e1', explanation: 'ex1', confidence: 75 },
  epistemic:       { framework: 'empiricist',        evidence: 'e2', explanation: 'ex2', confidence: 80 },
  political:       null,
  methodological:  null,
  alternativePerspectives: [
    { framework: 'Deontological', frameworkType: 'ethical', objection: 'obj1', specificity: 'sp1' },
  ],
  notes: null,
});

function makeProvider(content = VALID_RESULT_JSON): LlmProvider {
  return {
    name:     'mock',
    complete: async () => ({ content, inputTokens: 500, outputTokens: 200 }),
  };
}

function makeDeps(overrides: Partial<CommitmentsHandlerDeps> = {}): CommitmentsHandlerDeps {
  return {
    rateLimitKv:         undefined,
    geminiApiKey:        'test-key',
    commitmentsDailyCap: 15,
    provider:            makeProvider(),
    getSession:          async () => ({ userId: 'u-1' }),
    checkSubscription:   async () => true,
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request('https://test.example/api/philosophical-commitments', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleCommitmentsRequest', () => {
  it('returns 401 when not authenticated', async () => {
    const text = 'a'.repeat(60);
    const res  = await handleCommitmentsRequest(makeRequest({ text }), makeDeps({ getSession: async () => null }));
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 402 when subscription is not active', async () => {
    const text = 'a'.repeat(60);
    const res  = await handleCommitmentsRequest(makeRequest({ text }), makeDeps({ checkSubscription: async () => false }));
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(402);
    expect(data.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('https://test.example/api/philosophical-commitments', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'not-json',
    });
    const res  = await handleCommitmentsRequest(req, makeDeps());
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when text is too short', async () => {
    const res  = await handleCommitmentsRequest(makeRequest({ text: 'short' }), makeDeps());
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 503 when geminiApiKey is missing', async () => {
    const text = 'a'.repeat(60);
    const res  = await handleCommitmentsRequest(makeRequest({ text }), makeDeps({ geminiApiKey: undefined }));
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(503);
    expect(data.error.code).toBe('COMMITMENTS_FAILED');
  });

  it('returns ok result for valid subscribed request', async () => {
    const text = 'a'.repeat(60);
    const res  = await handleCommitmentsRequest(makeRequest({ text }), makeDeps());
    const data = await res.json() as { ok: boolean; result: unknown; usage: unknown };
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.usage).toBeDefined();
  });

  it('applies per-user rate limit when cap is reached', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const text  = 'a'.repeat(60);
    const deps  = makeDeps({
      rateLimitKv: {
        get: async () => JSON.stringify({ count: 15, day: today }),
        put: async () => {},
      } as unknown as CommitmentsHandlerDeps['rateLimitKv'],
      commitmentsDailyCap: 15,
    });
    const res  = await handleCommitmentsRequest(makeRequest({ text }), deps);
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('RATE_LIMITED');
  });
});
