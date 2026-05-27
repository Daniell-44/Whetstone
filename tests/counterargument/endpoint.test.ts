import { describe, it, expect } from 'vitest';
import { handleCounterargRequest } from '../../functions/_lib/counterargument/handler';
import type { CounterargHandlerDeps } from '../../functions/_lib/counterargument/handler';
import type { LlmProvider } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeKV {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

const MINIMAL_RESULT_JSON = JSON.stringify({
  centralClaim:     'Test central claim.',
  counterarguments: [
    {
      position:      'First opposing position.',
      strongestCase: { claim: 'c1', grounds: 'g1', warrant: 'w1' },
      missedByDraft: 'm1',
      why:           'y1',
    },
    {
      position:      'Second opposing position.',
      strongestCase: { claim: 'c2', grounds: 'g2', warrant: 'w2' },
      missedByDraft: 'm2',
      why:           'y2',
    },
  ],
  notes: null,
});

function makeProvider(content = MINIMAL_RESULT_JSON): LlmProvider {
  return {
    name:     'mock',
    complete: async () => ({ content, inputTokens: 10, outputTokens: 5 }),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rj(res: Response): Promise<any> { return res.json(); }

function makeDeps(overrides?: Partial<CounterargHandlerDeps>): CounterargHandlerDeps {
  return {
    rateLimitKv:        undefined,
    geminiApiKey:       'test-key',
    counterargDailyCap: 20,
    provider:           makeProvider(),
    getSession:         async () => ({ userId: 'user-test-123' }),
    ...overrides,
  };
}

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('https://test.example/api/counterargument', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

describe('POST /api/counterargument — auth gate', () => {
  it('returns 401 UNAUTHORIZED when no session is present', async () => {
    const deps = makeDeps({ getSession: async () => null });
    const req  = makeRequest({ text: 'a'.repeat(50) });
    const res  = await handleCounterargRequest(req, deps);
    const data = await rj(res);

    expect(res.status).toBe(401);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(data.error.message).toMatch(/sign in/i);
  });

  it('allows an authenticated user through', async () => {
    const req  = makeRequest({ text: 'a'.repeat(50) });
    const res  = await handleCounterargRequest(req, makeDeps());
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('POST /api/counterargument — input validation', () => {
  it('rejects text under 50 characters with 400', async () => {
    const req  = makeRequest({ text: 'too short' });
    const res  = await handleCounterargRequest(req, makeDeps());
    const data = await rj(res);

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('rejects text over 10,000 characters with 400', async () => {
    const req  = makeRequest({ text: 'a'.repeat(10_001) });
    const res  = await handleCounterargRequest(req, makeDeps());
    const data = await rj(res);

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('accepts text at exactly the minimum (50 chars)', async () => {
    const req  = makeRequest({ text: 'x'.repeat(50) });
    const res  = await handleCounterargRequest(req, makeDeps());
    expect(res.status).toBe(200);
    expect((await rj(res)).ok).toBe(true);
  });

  it('accepts text at exactly the maximum (10,000 chars)', async () => {
    const req  = makeRequest({ text: 'x'.repeat(10_000) });
    const res  = await handleCounterargRequest(req, makeDeps());
    expect(res.status).toBe(200);
    expect((await rj(res)).ok).toBe(true);
  });

  it('rejects invalid JSON body', async () => {
    const req = new Request('https://test.example/api/counterargument', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'not json {{{',
    });
    const res = await handleCounterargRequest(req, makeDeps());
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('POST /api/counterargument — rate limiting', () => {
  it('returns RATE_LIMITED when user has hit their daily cap', async () => {
    const kv  = new FakeKV();
    const deps = makeDeps({
      rateLimitKv:        kv,
      counterargDailyCap: 1,
    });

    // Use up the one allowed request.
    await handleCounterargRequest(makeRequest({ text: 'a'.repeat(50) }), deps);

    const res  = await handleCounterargRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('RATE_LIMITED');
    expect(data.error.message).toMatch(/try again tomorrow/i);
  });

  it('rate limits per user ID, not globally', async () => {
    const kv    = new FakeKV();
    const user1 = makeDeps({ rateLimitKv: kv, counterargDailyCap: 1, getSession: async () => ({ userId: 'u1' }) });
    const user2 = makeDeps({ rateLimitKv: kv, counterargDailyCap: 1, getSession: async () => ({ userId: 'u2' }) });

    // Exhaust user1.
    await handleCounterargRequest(makeRequest({ text: 'a'.repeat(50) }), user1);
    const blockedRes = await handleCounterargRequest(makeRequest({ text: 'a'.repeat(50) }), user1);
    expect((await rj(blockedRes)).error.code).toBe('RATE_LIMITED');

    // user2 is unaffected.
    const user2Res = await handleCounterargRequest(makeRequest({ text: 'a'.repeat(50) }), user2);
    expect((await rj(user2Res)).ok).toBe(true);
  });

  it('skips rate limiting when rateLimitKv is undefined', async () => {
    const deps = makeDeps({ rateLimitKv: undefined });
    const res  = await handleCounterargRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    expect((await rj(res)).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('POST /api/counterargument — success', () => {
  it('returns the counterargument result and usage on success', async () => {
    const req  = makeRequest({ text: 'a'.repeat(50) });
    const res  = await handleCounterargRequest(req, makeDeps());
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.result.centralClaim).toBe('Test central claim.');
    expect(data.result.counterarguments).toHaveLength(2);
    expect(data.usage.inputTokens).toBe(10);
    expect(data.usage.outputTokens).toBe(5);
  });
});
