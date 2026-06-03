import { describe, it, expect, beforeEach } from 'vitest';
import type { WorkspaceDb, WorkspaceMember, WorkspaceInvitation, Workspace, WorkspaceWithRole, WorkspaceRole } from '../../functions/_lib/workspaces/types';
import { handleCreateInvitation, handleAcceptInvitation } from '../../functions/_lib/workspaces/handlers';
import { hashToken } from '../../functions/_lib/auth/tokens';

// ---------------------------------------------------------------------------
// Minimal fake WorkspaceDb
// ---------------------------------------------------------------------------

let _workspaces:  Map<string, Workspace>;
let _members:     Map<string, WorkspaceMember>;
let _invitations: Map<string, WorkspaceInvitation>;
let _idSeq:       number;

function memberKey(wsId: string, uid: string) { return `${wsId}::${uid}`; }

function makeFakeDb(): WorkspaceDb {
  return {
    createWorkspace: async (id, name, ownerId) => {
      const now = Date.now();
      _workspaces.set(id, { id, name, owner_id: ownerId, created_at: now, updated_at: now });
    },
    getWorkspaceById: async (id) => _workspaces.get(id) ?? null,
    listWorkspacesForUser: async (uid) => {
      const result: WorkspaceWithRole[] = [];
      for (const m of _members.values()) {
        if (m.user_id !== uid) continue;
        const ws = _workspaces.get(m.workspace_id);
        if (ws) result.push({ ...ws, role: m.role });
      }
      return result;
    },
    updateWorkspaceName:  async () => {},
    deleteWorkspace:      async () => {},
    addMember: async (id, wsId, uid, role) => {
      _members.set(memberKey(wsId, uid), { id, workspace_id: wsId, user_id: uid, role, joined_at: Date.now() });
    },
    getMember: async (wsId, uid) => _members.get(memberKey(wsId, uid)) ?? null,
    listMembers: async (wsId) => [..._members.values()].filter(m => m.workspace_id === wsId),
    updateMemberRole: async () => {},
    removeMember:     async () => {},
    countMembers:     async (wsId) => [..._members.values()].filter(m => m.workspace_id === wsId).length,
    createInvitation: async (id, wsId, email, role, tokenHash, invitedBy, expiresAt) => {
      const now = Date.now();
      _invitations.set(id, { id, workspace_id: wsId, email, role, token_hash: tokenHash, invited_by: invitedBy, created_at: now, expires_at: expiresAt, accepted_at: null });
    },
    findInvitationByTokenHash:   async (h) => [..._invitations.values()].find(i => i.token_hash === h) ?? null,
    findPendingInvitationByEmail: async (wsId, email) =>
      [..._invitations.values()].find(i => i.workspace_id === wsId && i.email === email && i.accepted_at === null) ?? null,
    listPendingInvitations: async (wsId) => [..._invitations.values()].filter(i => i.workspace_id === wsId && i.accepted_at === null),
    acceptInvitation: async (id, at) => {
      const i = _invitations.get(id); if (i) _invitations.set(id, { ...i, accepted_at: at });
    },
    deleteInvitation: async (id) => { _invitations.delete(id); },
    listUserIdsWithNoMembership: async () => [],
    listDocumentIdsByUser:       async () => [],
    setDocumentWorkspace:        async () => {},
  };
}

let fakeDb: WorkspaceDb;
let idCounter = 0;
function newId() { return `id-${++idCounter}`; }

function sessionFor(userId: string) { return async (_req: Request) => ({ userId }); }
const noSession = async (_req: Request) => null;

function makeReq(method: string, body?: unknown): Request {
  return new Request('https://example.com', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function seed(name = 'W', ownerId = 'user-a') {
  const wsId  = newId();
  const memId = newId();
  await fakeDb.createWorkspace(wsId, name, ownerId);
  await fakeDb.addMember(memId, wsId, ownerId, 'owner');
  return wsId;
}

beforeEach(() => {
  _workspaces  = new Map();
  _members     = new Map();
  _invitations = new Map();
  idCounter    = 0;
  fakeDb       = makeFakeDb();
});

// ---------------------------------------------------------------------------
// handleCreateInvitation
// ---------------------------------------------------------------------------

const NOOP_EMAIL = async () => {};

describe('handleCreateInvitation', () => {
  it('returns 401 when unauthenticated', async () => {
    const wsId = await seed();
    const res  = await handleCreateInvitation(makeReq('POST', { email: 'x@y.com' }), wsId, {
      db: fakeDb, getSession: noSession, newId,
      sendInvitation: NOOP_EMAIL, siteUrl: 'https://test.local',
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is a plain member', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'member');
    const res = await handleCreateInvitation(makeReq('POST', { email: 'x@y.com' }), wsId, {
      db: fakeDb, getSession: sessionFor('user-b'), newId,
      sendInvitation: NOOP_EMAIL, siteUrl: 'https://test.local',
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid email', async () => {
    const wsId = await seed('W', 'user-a');
    const res  = await handleCreateInvitation(makeReq('POST', { email: 'not-an-email' }), wsId, {
      db: fakeDb, getSession: sessionFor('user-a'), newId,
      sendInvitation: NOOP_EMAIL, siteUrl: 'https://test.local',
    });
    expect(res.status).toBe(400);
  });

  it('creates an invitation and returns ok', async () => {
    const wsId = await seed('W', 'user-a');
    const res  = await handleCreateInvitation(makeReq('POST', { email: 'Bob@Example.com', role: 'member' }), wsId, {
      db: fakeDb, getSession: sessionFor('user-a'), newId,
      sendInvitation: NOOP_EMAIL, siteUrl: 'https://test.local',
    });
    const data = await res.json() as { ok: boolean; invitationId: string };
    expect(data.ok).toBe(true);
    const pending = await fakeDb.listPendingInvitations(wsId);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.email).toBe('bob@example.com');
  });

  it('returns 409 when a pending invitation already exists for that email', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.createInvitation('inv-1', wsId, 'dup@example.com', 'member', 'h99', 'user-a', Date.now() + 86400000);
    const res  = await handleCreateInvitation(makeReq('POST', { email: 'dup@example.com' }), wsId, {
      db: fakeDb, getSession: sessionFor('user-a'), newId,
      sendInvitation: NOOP_EMAIL, siteUrl: 'https://test.local',
    });
    expect(res.status).toBe(409);
  });

  it('calls sendInvitation with the correct accept URL', async () => {
    const wsId = await seed('Alpha Workspace', 'user-a');
    let capturedUrl = '';
    const res  = await handleCreateInvitation(makeReq('POST', { email: 'x@y.com' }), wsId, {
      db: fakeDb, getSession: sessionFor('user-a'), newId,
      sendInvitation: async (_to, _wsName, _inviter, acceptUrl) => { capturedUrl = acceptUrl; },
      siteUrl: 'https://test.local',
    });
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
    expect(capturedUrl).toMatch(/^https:\/\/test\.local\/api\/workspaces\/invitations\/accept\?token=/);
  });
});

// ---------------------------------------------------------------------------
// handleAcceptInvitation
// ---------------------------------------------------------------------------

describe('handleAcceptInvitation', () => {
  it('redirects to login when not authenticated', async () => {
    const wsId = await seed('W', 'user-a');
    const rawToken  = 'my-raw-token';
    const tokenHash = await hashToken(rawToken);
    await fakeDb.createInvitation('inv-1', wsId, 'bob@example.com', 'member', tokenHash, 'user-a', Date.now() + 86400000);

    const req = new Request(`https://example.com/api/workspaces/invitations/accept?token=${rawToken}`, { method: 'GET' });
    const res = await handleAcceptInvitation(req, { db: fakeDb, getSession: noSession, newId, siteUrl: 'https://test.local' });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/\/login\?returnTo=/);
  });

  it('redirects to error page for invalid token', async () => {
    const req = new Request('https://example.com/api/workspaces/invitations/accept?token=bogus', { method: 'GET' });
    const res = await handleAcceptInvitation(req, { db: fakeDb, getSession: sessionFor('user-b'), newId, siteUrl: 'https://test.local' });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/invalid_invitation/);
  });

  it('redirects to error page when no token provided', async () => {
    const req = new Request('https://example.com/api/workspaces/invitations/accept', { method: 'GET' });
    const res = await handleAcceptInvitation(req, { db: fakeDb, getSession: sessionFor('user-b'), newId, siteUrl: 'https://test.local' });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/invalid_invitation/);
  });

  it('accepts invitation and redirects to workspace settings', async () => {
    const wsId     = await seed('W', 'user-a');
    const rawToken = 'valid-raw-token';
    const hash     = await hashToken(rawToken);
    await fakeDb.createInvitation('inv-1', wsId, 'bob@example.com', 'member', hash, 'user-a', Date.now() + 86400000);

    const req = new Request(`https://example.com/api/workspaces/invitations/accept?token=${rawToken}`, { method: 'GET' });
    const res = await handleAcceptInvitation(req, { db: fakeDb, getSession: sessionFor('user-b'), newId, siteUrl: 'https://test.local' });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/\/workspaces\/.+\/settings\?joined=1/);
    expect(await fakeDb.getMember(wsId, 'user-b')).not.toBeNull();
    const inv = await fakeDb.findInvitationByTokenHash(hash);
    expect(inv?.accepted_at).not.toBeNull();
  });

  it('redirects to error page for expired invitation', async () => {
    const wsId     = await seed('W', 'user-a');
    const rawToken = 'expired-token';
    const hash     = await hashToken(rawToken);
    await fakeDb.createInvitation('inv-1', wsId, 'bob@example.com', 'member', hash, 'user-a', Date.now() - 1);

    const req = new Request(`https://example.com/api/workspaces/invitations/accept?token=${rawToken}`, { method: 'GET' });
    const res = await handleAcceptInvitation(req, { db: fakeDb, getSession: sessionFor('user-b'), newId, siteUrl: 'https://test.local' });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/invalid_invitation/);
  });

  it('is idempotent: already a member + already accepted does not error', async () => {
    const wsId     = await seed('W', 'user-a');
    const rawToken = 'reused-token';
    const hash     = await hashToken(rawToken);
    await fakeDb.createInvitation('inv-1', wsId, 'bob@example.com', 'member', hash, 'user-a', Date.now() + 86400000);

    const req1 = new Request(`https://example.com/api/workspaces/invitations/accept?token=${rawToken}`, { method: 'GET' });
    await handleAcceptInvitation(req1, { db: fakeDb, getSession: sessionFor('user-b'), newId, siteUrl: 'https://test.local' });

    // Second call — invitation now has accepted_at set → invalid.
    const req2 = new Request(`https://example.com/api/workspaces/invitations/accept?token=${rawToken}`, { method: 'GET' });
    const res2 = await handleAcceptInvitation(req2, { db: fakeDb, getSession: sessionFor('user-b'), newId, siteUrl: 'https://test.local' });
    expect(res2.status).toBe(302);
    expect(res2.headers.get('Location')).toMatch(/invalid_invitation/);
  });
});
