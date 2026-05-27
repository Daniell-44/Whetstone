import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthDb, DbUser, DbSession, DbMagicLink } from '../../functions/_lib/auth/db';
import type { RateLimitKV } from '../../functions/_lib/rate-limit';
import { handleRequestLink, handleVerify, handleLogout } from '../../functions/_lib/auth/handlers';
import { generateOpaqueToken, hashToken } from '../../functions/_lib/auth/tokens';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeAuthDb implements AuthDb {
  users       = new Map<string, DbUser>();
  sessions    = new Map<string, DbSession>();
  magicLinks  = new Map<string, DbMagicLink>();

  async findUserByEmail(email: string) {
    return [...this.users.values()].find(u => u.email === email) ?? null;
  }
  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }
  async createUser(id: string, email: string) {
    this.users.set(id, { id, email, created_at: new Date().toISOString() });
  }
  async createMagicLink(id: string, userId: string, tokenHash: string, expiresAt: string) {
    this.magicLinks.set(id, {
      id, user_id: userId, token_hash: tokenHash,
      created_at: new Date().toISOString(), expires_at: expiresAt, consumed_at: null,
    });
  }
  async findMagicLinkByTokenHash(tokenHash: string) {
    return [...this.magicLinks.values()].find(m => m.token_hash === tokenHash) ?? null;
  }
  async markMagicLinkConsumed(id: string) {
    const link = this.magicLinks.get(id);
    if (link) link.consumed_at = new Date().toISOString();
  }
  async createSession(id: string, userId: string, expiresAt: string) {
    this.sessions.set(id, { id, user_id: userId, created_at: new Date().toISOString(), expires_at: expiresAt });
  }
  async findSessionById(id: string) {
    return this.sessions.get(id) ?? null;
  }
  async deleteSession(id: string) {
    this.sessions.delete(id);
  }
  async extendSession(id: string, expiresAt: string) {
    const s = this.sessions.get(id);
    if (s) s.expires_at = expiresAt;
  }
}

class FakeKV implements RateLimitKV {
  private store = new Map<string, string>();
  async get(key: string) { return this.store.get(key) ?? null; }
  async put(key: string, value: string) { this.store.set(key, value); }
}

function postRequest(body: unknown, ip = '1.2.3.4'): Request {
  return new Request('https://test.example.com/api/auth/request-link', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body:    JSON.stringify(body),
  });
}

function verifyRequest(token: string): Request {
  return new Request(`https://test.example.com/api/auth/verify?token=${token}`);
}

function logoutRequest(sessionId?: string): Request {
  const headers: Record<string, string> = {};
  if (sessionId) headers['Cookie'] = `whetstone_session=${sessionId}`;
  return new Request('https://test.example.com/api/auth/logout', { method: 'POST', headers });
}

// ---------------------------------------------------------------------------
// handleRequestLink
// ---------------------------------------------------------------------------

describe('handleRequestLink', () => {
  let db: FakeAuthDb;
  let kv: FakeKV;
  const sendEmail = vi.fn().mockResolvedValue(undefined);

  function deps(overrides?: Partial<Parameters<typeof handleRequestLink>[1]>) {
    return { db, rateLimitKv: kv, sendEmail, siteUrl: 'https://test.example.com', ...overrides };
  }

  beforeEach(() => {
    db = new FakeAuthDb();
    kv = new FakeKV();
    sendEmail.mockClear();
  });

  it('returns 200 ok and sends email for new user', async () => {
    const res  = await handleRequestLink(postRequest({ email: 'new@example.com' }), deps());
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('returns 200 ok and sends email for existing user', async () => {
    await db.createUser('existing-id', 'existing@example.com');
    const res  = await handleRequestLink(postRequest({ email: 'existing@example.com' }), deps());
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('always returns 200 ok (no enumeration) even if sendEmail throws', async () => {
    sendEmail.mockRejectedValueOnce(new Error('Resend down'));
    const res  = await handleRequestLink(postRequest({ email: 'bad@example.com' }), deps());
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('returns 429 when rate limit exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      await handleRequestLink(postRequest({ email: `u${i}@x.com` }), deps({ authHourlyCap: 5 }));
    }
    const res  = await handleRequestLink(postRequest({ email: 'over@x.com' }), deps({ authHourlyCap: 5 }));
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid email', async () => {
    const res  = await handleRequestLink(postRequest({ email: 'notanemail' }), deps());
    const body = await res.json() as { ok: boolean };
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 405 for GET request', async () => {
    const req = new Request('https://test.example.com/api/auth/request-link');
    const res = await handleRequestLink(req, deps());
    expect(res.status).toBe(405);
  });

  it('creates a user and magic link on first sign-in', async () => {
    await handleRequestLink(postRequest({ email: 'first@example.com' }), deps());
    const user = await db.findUserByEmail('first@example.com');
    expect(user).not.toBeNull();
    expect(db.magicLinks.size).toBe(1);
  });

  it('normalises email to lowercase', async () => {
    await handleRequestLink(postRequest({ email: 'MiXeD@Example.COM' }), deps());
    const user = await db.findUserByEmail('mixed@example.com');
    expect(user).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// handleVerify
// ---------------------------------------------------------------------------

describe('handleVerify', () => {
  let db: FakeAuthDb;

  async function seedMagicLink(userId: string, expiresAt: string): Promise<string> {
    const token     = generateOpaqueToken();
    const tokenHash = await hashToken(token);
    await db.createMagicLink('link-1', userId, tokenHash, expiresAt);
    return token;
  }

  beforeEach(() => {
    db = new FakeAuthDb();
    db.users.set('user-1', { id: 'user-1', email: 'a@example.com', created_at: new Date().toISOString() });
  });

  it('redirects to /account and sets cookie for a valid token', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const token  = await seedMagicLink('user-1', future);

    const res = await handleVerify(verifyRequest(token), { db });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/account');
    expect(res.headers.get('Set-Cookie')).toMatch(/whetstone_session=/);
  });

  it('creates a session in the db after verification', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const token  = await seedMagicLink('user-1', future);

    await handleVerify(verifyRequest(token), { db });
    expect(db.sessions.size).toBe(1);
    const session = [...db.sessions.values()][0];
    expect(session?.user_id).toBe('user-1');
  });

  it('redirects to /login?error=invalid for missing token', async () => {
    const res = await handleVerify(
      new Request('https://test.example.com/api/auth/verify'),
      { db },
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?error=invalid');
  });

  it('redirects to /login?error=invalid for an expired token', async () => {
    const past  = new Date(Date.now() - 1000).toISOString();
    const token = await seedMagicLink('user-1', past);

    const res = await handleVerify(verifyRequest(token), { db });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?error=invalid');
  });

  it('redirects to /login?error=invalid for an already-consumed token', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const token  = await seedMagicLink('user-1', future);

    // Consume it once
    await handleVerify(verifyRequest(token), { db });
    // Try again
    const res = await handleVerify(verifyRequest(token), { db });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?error=invalid');
  });

  it('redirects to /login?error=invalid for an unknown token', async () => {
    const res = await handleVerify(verifyRequest('deadbeef'.repeat(8)), { db });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?error=invalid');
  });
});

// ---------------------------------------------------------------------------
// handleLogout
// ---------------------------------------------------------------------------

describe('handleLogout', () => {
  let db: FakeAuthDb;

  beforeEach(() => {
    db = new FakeAuthDb();
  });

  it('redirects to / and clears the session cookie', async () => {
    const res = await handleLogout(logoutRequest('some-session-id'), { db });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toMatch(/whetstone_session=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('deletes the session from the db', async () => {
    await db.createSession('sess-abc', 'user-1', new Date(Date.now() + 86400_000).toISOString());
    await handleLogout(logoutRequest('sess-abc'), { db });
    expect(db.sessions.size).toBe(0);
  });

  it('returns 302 even with no session cookie present', async () => {
    const res = await handleLogout(logoutRequest(), { db });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
  });
});
