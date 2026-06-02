import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthDb, DbUser, DbSession, DbMagicLink, TerminologyPreference } from '../../functions/_lib/auth/db';

// ---------------------------------------------------------------------------
// Minimal FakeAuthDb that implements the full interface
// ---------------------------------------------------------------------------

class FakeAuthDb implements AuthDb {
  users    = new Map<string, DbUser>();
  sessions = new Map<string, DbSession>();
  prefs    = new Map<string, TerminologyPreference>();

  async findUserByEmail(email: string) {
    return [...this.users.values()].find(u => u.email === email) ?? null;
  }
  async findUserById(id: string) { return this.users.get(id) ?? null; }
  async createUser(id: string, email: string) {
    this.users.set(id, { id, email, created_at: new Date().toISOString(), terminology_preference: 'plain' });
  }
  async createMagicLink() {}
  async findMagicLinkByTokenHash() { return null; }
  async markMagicLinkConsumed() {}
  async createSession(id: string, userId: string, expiresAt: string) {
    this.sessions.set(id, { id, user_id: userId, created_at: new Date().toISOString(), expires_at: expiresAt });
  }
  async findSessionById(id: string) { return this.sessions.get(id) ?? null; }
  async deleteSession(id: string) { this.sessions.delete(id); }
  async extendSession() {}
  async getTerminologyPreference(userId: string) {
    return this.prefs.get(userId) ?? 'plain';
  }
  async setTerminologyPreference(userId: string, preference: TerminologyPreference) {
    this.prefs.set(userId, preference);
  }
}

// ---------------------------------------------------------------------------
// Handler under test (extracted so we can test it without Astro env)
// ---------------------------------------------------------------------------

import { z } from 'zod';

const BodySchema = z.object({ preference: z.enum(['plain', 'formal']) });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function handleTerminology(
  req: Request,
  authDb:  AuthDb,
  session: { user_id: string } | null,
): Promise<Response> {
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED' } }, 401);

  let body: unknown;
  try { body = await req.json(); } catch {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'preference must be "plain" or "formal"' } }, 400);
  }

  await authDb.setTerminologyPreference(session.user_id, parsed.data.preference);
  return json({ ok: true, preference: parsed.data.preference });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(body: unknown) {
  return new Request('https://test.example.com/api/account/terminology', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

async function parseJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PATCH /api/account/terminology', () => {
  let db: FakeAuthDb;

  beforeEach(() => {
    db = new FakeAuthDb();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await handleTerminology(makeReq({ preference: 'formal' }), db, null);
    expect(res.status).toBe(401);
    const body = await parseJson(res);
    expect((body.error as Record<string, unknown>)?.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('https://test.example.com/api/account/terminology', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    'not-json',
    });
    const res = await handleTerminology(req, db, { user_id: 'u1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid preference value', async () => {
    const res = await handleTerminology(makeReq({ preference: 'invalid' }), db, { user_id: 'u1' });
    expect(res.status).toBe(400);
    const body = await parseJson(res);
    expect((body.error as Record<string, unknown>)?.code).toBe('BAD_REQUEST');
  });

  it('saves "plain" preference and returns 200', async () => {
    const res = await handleTerminology(makeReq({ preference: 'plain' }), db, { user_id: 'u1' });
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.ok).toBe(true);
    expect(body.preference).toBe('plain');
    expect(await db.getTerminologyPreference('u1')).toBe('plain');
  });

  it('saves "formal" preference and returns 200', async () => {
    const res = await handleTerminology(makeReq({ preference: 'formal' }), db, { user_id: 'u1' });
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.ok).toBe(true);
    expect(body.preference).toBe('formal');
    expect(await db.getTerminologyPreference('u1')).toBe('formal');
  });

  it('overrides an existing preference', async () => {
    db.prefs.set('u1', 'formal');
    const res = await handleTerminology(makeReq({ preference: 'plain' }), db, { user_id: 'u1' });
    expect(res.status).toBe(200);
    expect(await db.getTerminologyPreference('u1')).toBe('plain');
  });
});

// ---------------------------------------------------------------------------
// DB helper unit tests
// ---------------------------------------------------------------------------

describe('FakeAuthDb terminology methods', () => {
  it('getTerminologyPreference defaults to "plain"', async () => {
    const db = new FakeAuthDb();
    expect(await db.getTerminologyPreference('unknown')).toBe('plain');
  });

  it('setTerminologyPreference persists the value', async () => {
    const db = new FakeAuthDb();
    await db.setTerminologyPreference('u1', 'formal');
    expect(await db.getTerminologyPreference('u1')).toBe('formal');
  });
});
