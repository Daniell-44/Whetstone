import { describe, it, expect } from 'vitest';
import { handleEmailCapture, type EmailCaptureDeps } from '../../functions/_lib/email-capture/handler';
import type { EmailCaptureRow } from '../../functions/_lib/email-capture/db';
import type { RateLimitKV } from '../../functions/_lib/rate-limit';

// ---------------------------------------------------------------------------
// Fake insert — emulates INSERT OR IGNORE against UNIQUE(email, source):
// a duplicate (email, source) pair silently does nothing, exactly like D1.
// ---------------------------------------------------------------------------

function makeFakeStore() {
  const rows: EmailCaptureRow[] = [];
  return {
    rows,
    insert: async (row: EmailCaptureRow) => {
      if (rows.some(r => r.email === row.email && r.source === row.source)) return;
      rows.push(row);
    },
  };
}

// ---------------------------------------------------------------------------
// Fake KV for rate limiting
// ---------------------------------------------------------------------------

function makeFakeKv(): RateLimitKV & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return Object.assign(
    {
      async get(key: string) { return store.get(key) ?? null; },
      async put(key: string, value: string) { store.set(key, value); },
    },
    { store },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
function newId() { return `cap-${++idCounter}`; }

function postReq(body: unknown): Request {
  return new Request('https://test.example/api/email-capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeps(
  store: ReturnType<typeof makeFakeStore>,
  opts: { kv?: RateLimitKV; cap?: number } = {},
): EmailCaptureDeps {
  return {
    insert:      store.insert,
    rateLimitKv: opts.kv,
    dailyCap:    opts.cap ?? 10,
    rateKey:     'email-capture:ip:1.2.3.4',
    newId,
  };
}

// ---------------------------------------------------------------------------
// Method + validation
// ---------------------------------------------------------------------------

describe('handleEmailCapture — validation', () => {
  it('rejects non-POST method', async () => {
    const store = makeFakeStore();
    const req   = new Request('https://test.example/api/email-capture', { method: 'GET' });
    const res   = await handleEmailCapture(req, makeDeps(store));
    expect(res.status).toBe(405);
  });

  it('rejects invalid JSON', async () => {
    const store = makeFakeStore();
    const req   = new Request('https://test.example/api/email-capture', { method: 'POST', body: 'not json' });
    const res   = await handleEmailCapture(req, makeDeps(store));
    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  it('rejects a missing email', async () => {
    const store = makeFakeStore();
    const res   = await handleEmailCapture(postReq({ source: 'briefing' }), makeDeps(store));
    expect(res.status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });

  it('rejects a malformed email', async () => {
    const store = makeFakeStore();
    const res   = await handleEmailCapture(postReq({ email: 'not-an-email', source: 'briefing' }), makeDeps(store));
    expect(res.status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });

  it('rejects an overlong email', async () => {
    const store = makeFakeStore();
    const email = `${'x'.repeat(250)}@example.com`;   // > 254 chars total
    const res   = await handleEmailCapture(postReq({ email, source: 'briefing' }), makeDeps(store));
    expect(res.status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });

  it('rejects an unknown source', async () => {
    const store = makeFakeStore();
    const res   = await handleEmailCapture(postReq({ email: 'a@example.com', source: 'homepage' }), makeDeps(store));
    expect(res.status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });

  it('accepts all three known sources', async () => {
    for (const source of ['briefing', 'extension', 'footer'] as const) {
      const store = makeFakeStore();
      const res   = await handleEmailCapture(postReq({ email: 'a@example.com', source }), makeDeps(store));
      expect(res.status).toBe(200);
      expect(store.rows[0].source).toBe(source);
    }
  });
});

// ---------------------------------------------------------------------------
// Success + normalisation
// ---------------------------------------------------------------------------

describe('handleEmailCapture — success', () => {
  it('stores the row and returns ok', async () => {
    const store = makeFakeStore();
    const res   = await handleEmailCapture(postReq({ email: 'reader@example.com', source: 'briefing' }), makeDeps(store));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0].email).toBe('reader@example.com');
    expect(store.rows[0].source).toBe('briefing');
    expect(store.rows[0].created_at).toBeGreaterThan(0);
  });

  it('trims and lowercases the address before storing', async () => {
    const store = makeFakeStore();
    const res   = await handleEmailCapture(postReq({ email: '  Reader@Example.COM  ', source: 'footer' }), makeDeps(store));
    expect(res.status).toBe(200);
    expect(store.rows[0].email).toBe('reader@example.com');
  });
});

// ---------------------------------------------------------------------------
// Duplicate silence — the response must never leak list membership
// ---------------------------------------------------------------------------

describe('handleEmailCapture — duplicate silence', () => {
  it('returns ok for a repeat (email, source) without adding a second row', async () => {
    const store = makeFakeStore();

    const first = await handleEmailCapture(postReq({ email: 'reader@example.com', source: 'briefing' }), makeDeps(store));
    expect(first.status).toBe(200);

    const second = await handleEmailCapture(postReq({ email: 'reader@example.com', source: 'briefing' }), makeDeps(store));
    expect(second.status).toBe(200);
    const secondBody = await second.json() as { ok: boolean };
    expect(secondBody.ok).toBe(true);          // indistinguishable from a fresh signup
    expect(store.rows).toHaveLength(1);
  });

  it('duplicate detection survives case/whitespace variants of the same address', async () => {
    const store = makeFakeStore();
    await handleEmailCapture(postReq({ email: 'reader@example.com', source: 'briefing' }), makeDeps(store));
    const res = await handleEmailCapture(postReq({ email: ' READER@example.com ', source: 'briefing' }), makeDeps(store));
    expect(res.status).toBe(200);
    expect(store.rows).toHaveLength(1);
  });

  it('the same address on a different surface is a distinct row', async () => {
    const store = makeFakeStore();
    await handleEmailCapture(postReq({ email: 'reader@example.com', source: 'briefing' }), makeDeps(store));
    const res = await handleEmailCapture(postReq({ email: 'reader@example.com', source: 'extension' }), makeDeps(store));
    expect(res.status).toBe(200);
    expect(store.rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('handleEmailCapture — rate limiting', () => {
  it('allows up to cap requests per day', async () => {
    const store = makeFakeStore();
    const kv    = makeFakeKv();

    for (let i = 0; i < 3; i++) {
      const res = await handleEmailCapture(
        postReq({ email: `r${i}@example.com`, source: 'footer' }),
        makeDeps(store, { kv, cap: 3 }),
      );
      expect(res.status).toBe(200);
    }
    expect(store.rows).toHaveLength(3);
  });

  it('blocks with 429 once the cap is exceeded', async () => {
    const store = makeFakeStore();
    const kv    = makeFakeKv();

    for (let i = 0; i < 2; i++) {
      await handleEmailCapture(postReq({ email: `r${i}@example.com`, source: 'footer' }), makeDeps(store, { kv, cap: 2 }));
    }

    const res = await handleEmailCapture(postReq({ email: 'r3@example.com', source: 'footer' }), makeDeps(store, { kv, cap: 2 }));
    expect(res.status).toBe(429);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(store.rows).toHaveLength(2);
  });

  it('skips rate limiting when kv is not configured', async () => {
    const store = makeFakeStore();
    const res   = await handleEmailCapture(postReq({ email: 'r@example.com', source: 'footer' }), makeDeps(store, { kv: undefined }));
    expect(res.status).toBe(200);
  });
});
