import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthDb, DbUser, DbSession, DbMagicLink } from '../../functions/_lib/auth/db';
import type { RateLimitKV } from '../../functions/_lib/rate-limit';
import type { LlmProvider } from '../../functions/_lib/providers/types';
import type { ExtractResult } from '../../functions/_lib/extract/article';
import { handleCitationAuditRequest } from '../../functions/_lib/citation-audit/handler';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeAuthDb implements AuthDb {
  users    = new Map<string, DbUser>();
  sessions = new Map<string, DbSession>();

  async findUserByEmail(email: string) { return [...this.users.values()].find(u => u.email === email) ?? null; }
  async findUserById(id: string)       { return this.users.get(id) ?? null; }
  async createUser(id: string, email: string) {
    this.users.set(id, { id, email, created_at: new Date().toISOString(), terminology_preference: 'plain' });
  }
  async createMagicLink()             {}
  async findMagicLinkByTokenHash()    { return null; }
  async findLatestActiveMagicLinkForUser() { return null; }
  async markMagicLinkConsumed()       {}
  async incrementMagicLinkCodeAttempts() {}
  async createSession(id: string, userId: string, expiresAt: string) {
    this.sessions.set(id, { id, user_id: userId, created_at: new Date().toISOString(), expires_at: expiresAt });
  }
  async findSessionById(id: string)   { return this.sessions.get(id) ?? null; }
  async deleteSession(id: string)     { this.sessions.delete(id); }
  async extendSession()               {}
  async getTerminologyPreference()    { return 'plain' as const; }
  async setTerminologyPreference()    {}
}

class FakeKV implements RateLimitKV {
  private store = new Map<string, string>();
  async get(key: string) { return this.store.get(key) ?? null; }
  async put(key: string, value: string) { this.store.set(key, value); }
  /** Test-only visibility into which quota keys the handler wrote. */
  keys(): string[] { return [...this.store.keys()]; }
}

function fakeLlmProvider(): LlmProvider {
  return {
    name: 'fake',
    complete: vi.fn().mockResolvedValue({
      content:      JSON.stringify({ claims: [] }),
      inputTokens:  5,
      outputTokens: 10,
    }),
  };
}

function fakeExtractor(): (url: string) => Promise<ExtractResult> {
  return vi.fn().mockResolvedValue({
    ok:      true,
    article: { title: 'T', publication: 'P', url: 'https://x', text: 'content' },
  });
}

function postReq(body: unknown, sessionId?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionId) headers['Cookie'] = `whetstone_session=${sessionId}`;
  return new Request('https://test.example.com/api/citation-audit', {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  });
}

const DUMMY_TEXT = 'A factual claim about the world without a source. '.repeat(3);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleCitationAuditRequest', () => {
  let kv:      FakeKV;
  let provider: LlmProvider;

  beforeEach(() => {
    kv       = new FakeKV();
    provider = fakeLlmProvider();
  });

  function deps(overrides?: Partial<Parameters<typeof handleCitationAuditRequest>[1]>) {
    return {
      rateLimitKv:       kv,
      geminiApiKey:      'test-key',
      citationDailyCap:  10,
      provider,
      extractor:         fakeExtractor(),
      getSession:        async () => ({ userId: 'u1' }),
      checkSubscription: async () => true,
      ...overrides,
    };
  }

  // Free-tier decision (2026-08-14): the handler no longer turns anyone away
  // for lacking a session or a subscription; the endpoint's anonymous session
  // gate is what enforces sign-in after three runs.

  it('runs for an anonymous caller and keys the quota by IP', async () => {
    const req = new Request('https://test.example.com/api/citation-audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
      body:    JSON.stringify({ text: DUMMY_TEXT }),
    });
    const res = await handleCitationAuditRequest(req, deps({ getSession: async () => null }));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(kv.keys()).toContain('citation:ip:203.0.113.9');
  });

  it('runs for a signed-in user with no active subscription', async () => {
    const res = await handleCitationAuditRequest(
      postReq({ text: DUMMY_TEXT }),
      deps({ checkSubscription: async () => false }),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const d = deps({ citationDailyCap: 2 });
    await handleCitationAuditRequest(postReq({ text: DUMMY_TEXT }), d);
    await handleCitationAuditRequest(postReq({ text: DUMMY_TEXT }), d);
    const res = await handleCitationAuditRequest(postReq({ text: DUMMY_TEXT }), d);
    expect(res.status).toBe(429);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('returns 400 for text shorter than 50 chars', async () => {
    const res = await handleCitationAuditRequest(postReq({ text: 'short' }), deps());
    expect(res.status).toBe(400);
  });

  it('returns 400 for text longer than 10,000 chars', async () => {
    const res = await handleCitationAuditRequest(postReq({ text: 'a'.repeat(10_001) }), deps());
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('https://test.example.com/api/citation-audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'not-json',
    });
    const res = await handleCitationAuditRequest(req, deps());
    expect(res.status).toBe(400);
  });

  it('returns 503 when geminiApiKey is missing', async () => {
    const res = await handleCitationAuditRequest(
      postReq({ text: DUMMY_TEXT }),
      deps({ geminiApiKey: undefined }),
    );
    expect(res.status).toBe(503);
  });

  it('returns 200 with result and usage for valid subscribed request', async () => {
    const res  = await handleCitationAuditRequest(postReq({ text: DUMMY_TEXT }), deps());
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      result: unknown;
      usage: { inputTokens: number; outputTokens: number; citationsFetched: number; citationsFailed: number };
    };
    expect(body.ok).toBe(true);
    expect(body.result).toBeDefined();
    expect(typeof body.usage.inputTokens).toBe('number');
    expect(typeof body.usage.outputTokens).toBe('number');
    expect(typeof body.usage.citationsFetched).toBe('number');
    expect(typeof body.usage.citationsFailed).toBe('number');
  });

  it('returns 405 for GET request', async () => {
    const req = new Request('https://test.example.com/api/citation-audit');
    const res = await handleCitationAuditRequest(req, deps());
    expect(res.status).toBe(405);
  });

  it('rate limit is per-user (different users have independent quotas)', async () => {
    const d1 = deps({ citationDailyCap: 1, getSession: async () => ({ userId: 'user-1' }) });
    const d2 = deps({ citationDailyCap: 1, getSession: async () => ({ userId: 'user-2' }), rateLimitKv: d1.rateLimitKv });

    await handleCitationAuditRequest(postReq({ text: DUMMY_TEXT }), d1); // exhausts user-1
    const res = await handleCitationAuditRequest(postReq({ text: DUMMY_TEXT }), d2); // user-2 unaffected
    expect(res.status).toBe(200);
  });

  // --- Server-side persistence (the phone-lock fix): the handler writes the
  // result onto the version itself when documentId+versionId are supplied, so
  // the client's old follow-up persist fetch (which died with a suspended tab)
  // is no longer load-bearing. ---

  it('persists the result server-side when documentId + versionId are supplied', async () => {
    const persistResult = vi.fn().mockResolvedValue(true);
    const res = await handleCitationAuditRequest(
      postReq({ text: DUMMY_TEXT, documentId: 'doc-1', versionId: 'ver-1' }),
      deps({ persistResult }),
    );
    expect(res.status).toBe(200);
    expect(persistResult).toHaveBeenCalledTimes(1);
    const [userId, docId, verId, resultJson] = persistResult.mock.calls[0]!;
    expect(userId).toBe('u1');
    expect(docId).toBe('doc-1');
    expect(verId).toBe('ver-1');
    expect(() => JSON.parse(resultJson as string)).not.toThrow();
  });

  it('does not attempt persistence without a version target', async () => {
    const persistResult = vi.fn().mockResolvedValue(true);
    const res = await handleCitationAuditRequest(
      postReq({ text: DUMMY_TEXT }),
      deps({ persistResult }),
    );
    expect(res.status).toBe(200);
    expect(persistResult).not.toHaveBeenCalled();
  });

  it('does not attempt persistence for an anonymous caller even with a version target', async () => {
    const persistResult = vi.fn().mockResolvedValue(true);
    const res = await handleCitationAuditRequest(
      postReq({ text: DUMMY_TEXT, documentId: 'doc-1', versionId: 'ver-1' }),
      deps({ persistResult, getSession: async () => null }),
    );
    expect(res.status).toBe(200);
    expect(persistResult).not.toHaveBeenCalled();
  });

  it('a persistence failure never fails the run', async () => {
    const persistResult = vi.fn().mockRejectedValue(new Error('D1 exploded'));
    const res = await handleCitationAuditRequest(
      postReq({ text: DUMMY_TEXT, documentId: 'doc-1', versionId: 'ver-1' }),
      deps({ persistResult }),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('registers the run with waitUntil so a client disconnect cannot kill it', async () => {
    const waitUntil = vi.fn();
    const res = await handleCitationAuditRequest(
      postReq({ text: DUMMY_TEXT, documentId: 'doc-1', versionId: 'ver-1' }),
      deps({ persistResult: vi.fn().mockResolvedValue(true), waitUntil }),
    );
    expect(res.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0]![0]).toBeInstanceOf(Promise);
  });
});
