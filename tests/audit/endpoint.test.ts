import { describe, it, expect } from 'vitest';
import { handleAuditRequest } from '../../functions/_lib/audit/handler';
import type { AuditHandlerDeps } from '../../functions/_lib/audit/handler';
import type { LlmProvider } from '../../functions/_lib/providers/types';
import type { ExtractResult } from '../../functions/_lib/extract/article';
import { FREE_USE_ALLOWANCE } from '../../functions/_lib/billing/limits';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;
async function rj(res: Response): Promise<AnyData> { return res.json(); }

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

const MINIMAL_AUDIT_JSON = JSON.stringify({
  centralClaim:   'Test central claim.',
  toulmin: {
    claim:            'Test claim.',
    grounds:          'Test grounds.',
    statedWarrant:    null,
    unstatedWarrants: [],
    weakestLink:      'Test weakest link.',
  },
  namedFallacies: [],
  loadedLanguage: [],
  notes:          null,
});

function makeProvider(content = MINIMAL_AUDIT_JSON): LlmProvider {
  return {
    name:     'mock',
    complete: async () => ({ content, inputTokens: 10, outputTokens: 5 }),
  };
}

const PASSING_EXTRACTOR = async (url: string): Promise<ExtractResult> => ({
  ok:      true,
  article: {
    title:       'Test Article',
    publication: 'Test Publication',
    url,
    text:        'This is a sufficiently long piece of extracted article text that satisfies the audit engine minimum length requirement without any trouble.',
  },
});

const FAILING_EXTRACTOR = async (_url: string): Promise<ExtractResult> => ({
  ok:    false,
  error: { code: 'FETCH_FAILED', message: 'Network error: connection refused' },
});

const TOO_SHORT_EXTRACTOR = async (_url: string): Promise<ExtractResult> => ({
  ok:    false,
  error: { code: 'TOO_SHORT', message: 'Extracted 42 words; minimum is 250' },
});

function makeDeps(overrides?: Partial<AuditHandlerDeps>): AuditHandlerDeps {
  return {
    rateLimitKv:   undefined,
    geminiApiKey:  'test-key',
    provider:      makeProvider(),
    extractor:     PASSING_EXTRACTOR,
    ...overrides,
  };
}

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('https://test.example/api/audit', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe('POST /api/audit — input validation', () => {
  it('rejects body with both text and url', async () => {
    const req = makeRequest({ text: 'a'.repeat(50), url: 'https://example.com' });
    const res = await handleAuditRequest(req, makeDeps());
    const data = await rj(res);
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('rejects body with neither text nor url', async () => {
    const req = makeRequest({});
    const res = await handleAuditRequest(req, makeDeps());
    const data = await rj(res);
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('rejects text under 50 characters', async () => {
    const req = makeRequest({ text: 'too short' });
    const res = await handleAuditRequest(req, makeDeps());
    const data = await rj(res);
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('rejects text over 10,000 characters', async () => {
    const req = makeRequest({ text: 'a'.repeat(10_001) });
    const res = await handleAuditRequest(req, makeDeps());
    const data = await rj(res);
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('rejects a non-URL string in the url field', async () => {
    const req = makeRequest({ url: 'not-a-url' });
    const res = await handleAuditRequest(req, makeDeps());
    const data = await rj(res);
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('rejects invalid JSON body', async () => {
    const req = new Request('https://test.example/api/audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'not json {{{',
    });
    const res = await handleAuditRequest(req, makeDeps());
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Text path
// ---------------------------------------------------------------------------

describe('POST /api/audit — text path', () => {
  it('returns a successful audit for valid text input', async () => {
    const req  = makeRequest({ text: 'a'.repeat(50) });
    const res  = await handleAuditRequest(req, makeDeps());
    const data = await rj(res);
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.audit.centralClaim).toBe('Test central claim.');
    expect(data.usage.inputTokens).toBe(10);
    expect(data.usage.outputTokens).toBe(5);
  });

  it('accepts text at exactly the minimum (50 chars)', async () => {
    const req  = makeRequest({ text: 'x'.repeat(50) });
    const res  = await handleAuditRequest(req, makeDeps());
    expect(res.status).toBe(200);
    expect((await rj(res)).ok).toBe(true);
  });

  it('accepts text at exactly the maximum (10,000 chars)', async () => {
    const req  = makeRequest({ text: 'x'.repeat(10_000) });
    const res  = await handleAuditRequest(req, makeDeps());
    expect(res.status).toBe(200);
    expect((await rj(res)).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// URL path
// ---------------------------------------------------------------------------

describe('POST /api/audit — URL path', () => {
  it('extracts from URL and returns a successful audit', async () => {
    const req  = makeRequest({ url: 'https://example.com/article' });
    const res  = await handleAuditRequest(req, makeDeps());
    const data = await rj(res);
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.audit.centralClaim).toBe('Test central claim.');
  });

  it('returns FETCH_FAILED when extractor fails', async () => {
    const req  = makeRequest({ url: 'https://example.com/article' });
    const res  = await handleAuditRequest(req, makeDeps({ extractor: FAILING_EXTRACTOR }));
    const data = await rj(res);
    expect(res.status).toBe(200);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('FETCH_FAILED');
  });

  it('returns TOO_SHORT when extracted content is too short', async () => {
    const req  = makeRequest({ url: 'https://example.com/stub' });
    const res  = await handleAuditRequest(req, makeDeps({ extractor: TOO_SHORT_EXTRACTOR }));
    const data = await rj(res);
    expect(res.status).toBe(200);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('TOO_SHORT');
  });
});

// ---------------------------------------------------------------------------
// Usage allowance — one open allowance, no tiers
// ---------------------------------------------------------------------------

describe('POST /api/audit — usage allowance', () => {
  it('allows requests up to the allowance', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({ rateLimitKv: kv, freeUseAllowance: 3 });

    for (let i = 0; i < 3; i++) {
      const res = await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
      expect((await rj(res)).ok).toBe(true);
    }
  });

  it('returns RATE_LIMITED with HTTP 200 once the allowance is spent', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({ rateLimitKv: kv });

    for (let i = 0; i < FREE_USE_ALLOWANCE; i++) {
      await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    }

    const res  = await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(res);
    expect(res.status).toBe(200);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('RATE_LIMITED');
    expect(data.error.message).toMatch(/unlocks/i);
  });

  it('tells the caller when the allowance reopens', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({ rateLimitKv: kv, freeUseAllowance: 1 });

    await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps));

    expect(data.error.message).toMatch(/next one unlocks in about 24 hours/i);
    expect(Number.isNaN(Date.parse(data.error.resetAt))).toBe(false);
  });

  it('never points a blocked caller at signing in or subscribing', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({ rateLimitKv: kv, freeUseAllowance: 1 });

    await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps));

    expect(data.error.message).not.toMatch(/sign in|subscribe|subscription|upgrade/i);
  });

  it('falls back to the built-in allowance when the override is malformed', async () => {
    const kv   = new FakeKV();
    // parseInt('') is NaN — a missing or junk env var must not mean "zero uses".
    const deps = makeDeps({ rateLimitKv: kv, freeUseAllowance: NaN });

    for (let i = 0; i < FREE_USE_ALLOWANCE; i++) {
      expect((await rj(await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps))).ok).toBe(true);
    }
    expect((await rj(await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps))).ok).toBe(false);
  });

  it('skips the allowance entirely when rateLimitKv is undefined', async () => {
    const deps = makeDeps({ rateLimitKv: undefined });
    const res  = await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    expect((await rj(res)).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Identity — signing in moves the count, it does not raise the cap
// ---------------------------------------------------------------------------

describe('POST /api/audit — allowance identity', () => {
  it('counts a signed-in caller against their account', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({
      rateLimitKv:      kv,
      freeUseAllowance: 1,
      getSession:       async () => ({ userId: 'user-xyz' }),
    });

    await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps));
    expect(data.error.code).toBe('RATE_LIMITED');
  });

  it('gives a signed-in caller no more audits than an anonymous one', async () => {
    const kv     = new FakeKV();
    const anon   = makeDeps({ rateLimitKv: kv, getSession: async () => null });
    const signed = makeDeps({ rateLimitKv: kv, getSession: async () => ({ userId: 'u-1' }) });

    const spend = async (deps: AuditHandlerDeps) => {
      let allowed = 0;
      for (let i = 0; i < FREE_USE_ALLOWANCE + 2; i++) {
        if ((await rj(await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps))).ok) allowed++;
      }
      return allowed;
    };

    expect(await spend(anon)).toBe(FREE_USE_ALLOWANCE);
    expect(await spend(signed)).toBe(FREE_USE_ALLOWANCE);
  });

  it('keeps two anonymous callers on different IPs independent', async () => {
    const kv  = new FakeKV();
    const req = (ip: string) => new Request('https://test.example/api/audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body:    JSON.stringify({ text: 'a'.repeat(50) }),
    });
    const deps = makeDeps({ rateLimitKv: kv, freeUseAllowance: 1, getSession: async () => null });

    await handleAuditRequest(req('1.1.1.1'), deps);
    expect((await rj(await handleAuditRequest(req('1.1.1.1'), deps))).ok).toBe(false);
    expect((await rj(await handleAuditRequest(req('2.2.2.2'), deps))).ok).toBe(true);
  });

  it('applies the allowance with no getSession wired at all', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({ rateLimitKv: kv });

    for (let i = 0; i < FREE_USE_ALLOWANCE; i++) {
      await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    }
    const data = await rj(await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps));
    expect(data.error.code).toBe('RATE_LIMITED');
  });
});
