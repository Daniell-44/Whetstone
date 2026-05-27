import { describe, it, expect } from 'vitest';
import { handleAuditRequest } from '../../functions/_lib/audit/handler';
import type { AuditHandlerDeps } from '../../functions/_lib/audit/handler';
import type { LlmProvider } from '../../functions/_lib/providers/types';
import type { ExtractResult } from '../../functions/_lib/extract/article';

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
    auditDailyCap: 10,
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
// Rate limiting
// ---------------------------------------------------------------------------

describe('POST /api/audit — rate limiting', () => {
  it('allows requests up to the daily cap', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({ rateLimitKv: kv, auditDailyCap: 3 });

    for (let i = 0; i < 3; i++) {
      const req  = makeRequest({ text: 'a'.repeat(50) });
      const res  = await handleAuditRequest(req, deps);
      const data = await rj(res);
      expect(data.ok).toBe(true);
    }
  });

  it('returns RATE_LIMITED with HTTP 200 after the cap is exceeded', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({ rateLimitKv: kv, auditDailyCap: 1 });

    // Use up the one allowed request.
    await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);

    // The next request should be blocked.
    const res  = await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(res);
    expect(res.status).toBe(200);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('RATE_LIMITED');
    expect(data.error.message).toMatch(/try again tomorrow/i);
  });

  it('skips rate limiting when rateLimitKv is undefined', async () => {
    const deps = makeDeps({ rateLimitKv: undefined });
    const req  = makeRequest({ text: 'a'.repeat(50) });
    const res  = await handleAuditRequest(req, deps);
    expect((await rj(res)).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Session-aware rate limiting
// ---------------------------------------------------------------------------

describe('POST /api/audit — session-aware rate limiting', () => {
  it('uses per-user limit and bypasses IP limit for authenticated users', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({
      rateLimitKv:       kv,
      auditDailyCap:     0,      // IP cap = 0 — any anonymous request would be blocked
      auditUserDailyCap: 10,     // user cap = 10 — should pass through
      getSession: async () => ({ userId: 'user-abc' }),
    });

    const req  = makeRequest({ text: 'a'.repeat(50) });
    const res  = await handleAuditRequest(req, deps);
    expect((await rj(res)).ok).toBe(true);
  });

  it('returns RATE_LIMITED when authenticated user hits their per-user cap', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({
      rateLimitKv:       kv,
      auditUserDailyCap: 1,
      getSession: async () => ({ userId: 'user-xyz' }),
    });

    // Use up the one allowed request.
    await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);

    const res  = await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(res);
    expect(res.status).toBe(200);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('RATE_LIMITED');
  });

  it('falls back to IP rate limit when getSession returns null', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({
      rateLimitKv:    kv,
      auditDailyCap:  1,
      getSession:     async () => null,
    });

    // First request succeeds.
    await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);

    // Second is blocked by IP limit.
    const res  = await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(res);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('RATE_LIMITED');
  });

  it('anonymous behaviour is unchanged when getSession is not provided', async () => {
    const kv   = new FakeKV();
    const deps = makeDeps({ rateLimitKv: kv, auditDailyCap: 1 }); // no getSession

    await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);

    const res  = await handleAuditRequest(makeRequest({ text: 'a'.repeat(50) }), deps);
    const data = await rj(res);
    expect(data.error.code).toBe('RATE_LIMITED');
  });
});
