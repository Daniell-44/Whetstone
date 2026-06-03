import { describe, it, expect, beforeEach } from 'vitest';
import type { WorkspaceDb, WorkspaceMember, WorkspaceInvitation, Workspace, WorkspaceWithRole, WorkspaceRole } from '../../functions/_lib/workspaces/types';
import {
  handleListWorkspaces,
  handleCreateWorkspace,
  handleGetWorkspace,
  handleUpdateWorkspace,
  handleDeleteWorkspace,
  handleListMembers,
  handleUpdateMember,
  handleRemoveMember,
  handleListInvitations,
  handleRevokeInvitation,
  handleBackfillWorkspaces,
} from '../../functions/_lib/workspaces/handlers';

// ---------------------------------------------------------------------------
// Fake WorkspaceDb
// ---------------------------------------------------------------------------

let _workspaces:  Map<string, Workspace>;
let _members:     Map<string, WorkspaceMember>;
let _invitations: Map<string, WorkspaceInvitation>;
let _idSeq:       number;

function memberKey(wsId: string, userId: string) { return `${wsId}::${userId}`; }

function makeFakeDb(): WorkspaceDb {
  return {
    createWorkspace: async (id, name, ownerId) => {
      const now = Date.now();
      _workspaces.set(id, { id, name, owner_id: ownerId, created_at: now, updated_at: now });
    },
    getWorkspaceById: async (id) => _workspaces.get(id) ?? null,
    listWorkspacesForUser: async (userId) => {
      const result: WorkspaceWithRole[] = [];
      for (const m of _members.values()) {
        if (m.user_id !== userId) continue;
        const ws = _workspaces.get(m.workspace_id);
        if (ws) result.push({ ...ws, role: m.role });
      }
      return result;
    },
    updateWorkspaceName: async (id, name) => {
      const ws = _workspaces.get(id);
      if (ws) _workspaces.set(id, { ...ws, name });
    },
    deleteWorkspace: async (id) => { _workspaces.delete(id); },
    addMember: async (id, wsId, userId, role) => {
      _members.set(memberKey(wsId, userId), { id, workspace_id: wsId, user_id: userId, role, joined_at: Date.now() });
    },
    getMember: async (wsId, userId) => _members.get(memberKey(wsId, userId)) ?? null,
    listMembers: async (wsId) => [..._members.values()].filter(m => m.workspace_id === wsId),
    updateMemberRole: async (wsId, userId, role) => {
      const m = _members.get(memberKey(wsId, userId));
      if (m) _members.set(memberKey(wsId, userId), { ...m, role });
    },
    removeMember: async (wsId, userId) => { _members.delete(memberKey(wsId, userId)); },
    countMembers: async (wsId) => [..._members.values()].filter(m => m.workspace_id === wsId).length,
    createInvitation: async (id, wsId, email, role, tokenHash, invitedBy, expiresAt) => {
      const now = Date.now();
      _invitations.set(id, { id, workspace_id: wsId, email, role, token_hash: tokenHash, invited_by: invitedBy, created_at: now, expires_at: expiresAt, accepted_at: null });
    },
    findInvitationByTokenHash: async (h) => [..._invitations.values()].find(i => i.token_hash === h) ?? null,
    findPendingInvitationByEmail: async (wsId, email) =>
      [..._invitations.values()].find(i => i.workspace_id === wsId && i.email === email && i.accepted_at === null) ?? null,
    listPendingInvitations: async (wsId) => [..._invitations.values()].filter(i => i.workspace_id === wsId && i.accepted_at === null),
    acceptInvitation: async (id, at) => {
      const i = _invitations.get(id); if (i) _invitations.set(id, { ...i, accepted_at: at });
    },
    deleteInvitation: async (id) => { _invitations.delete(id); },
    listUserIdsWithNoMembership: async () => [],
    listDocumentIdsByUser: async () => [],
    setDocumentWorkspace: async () => {},
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(method: string, body?: unknown): Request {
  return new Request('https://example.com', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function sessionFor(userId: string) {
  return async (_req: Request) => ({ userId });
}
const noSession = async (_req: Request) => null;

let fakeDb: WorkspaceDb;
let idCounter = 0;
function newId() { return `id-${++idCounter}`; }

async function seed(name = 'My WS', ownerId = 'user-a') {
  const wsId  = newId();
  const memId = newId();
  await fakeDb.createWorkspace(wsId, name, ownerId);
  await fakeDb.addMember(memId, wsId, ownerId, 'owner');
  return wsId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  _workspaces  = new Map();
  _members     = new Map();
  _invitations = new Map();
  idCounter    = 0;
  fakeDb       = makeFakeDb();
});

const deps = (userId?: string) => ({
  db:         fakeDb,
  getSession: userId ? sessionFor(userId) : noSession,
  newId,
});

// ----- handleListWorkspaces -----

describe('handleListWorkspaces', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await handleListWorkspaces(makeReq('GET'), deps());
    expect(res.status).toBe(401);
  });

  it('returns empty list when user has no workspaces', async () => {
    const res  = await handleListWorkspaces(makeReq('GET'), deps('user-a'));
    const data = await res.json() as { ok: boolean; workspaces: unknown[] };
    expect(data.ok).toBe(true);
    expect(data.workspaces).toHaveLength(0);
  });

  it('returns workspaces the user belongs to', async () => {
    await seed('WS1', 'user-a');
    await seed('WS2', 'user-a');
    const res  = await handleListWorkspaces(makeReq('GET'), deps('user-a'));
    const data = await res.json() as { workspaces: unknown[] };
    expect(data.workspaces).toHaveLength(2);
  });
});

// ----- handleCreateWorkspace -----

describe('handleCreateWorkspace', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await handleCreateWorkspace(makeReq('POST', { name: 'W' }), deps());
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing name', async () => {
    const res = await handleCreateWorkspace(makeReq('POST', {}), deps('user-a'));
    expect(res.status).toBe(400);
  });

  it('creates workspace and owner membership', async () => {
    const res  = await handleCreateWorkspace(makeReq('POST', { name: 'Alpha' }), deps('user-a'));
    const data = await res.json() as { ok: boolean; workspaceId: string };
    expect(data.ok).toBe(true);
    const ws = await fakeDb.getWorkspaceById(data.workspaceId);
    expect(ws?.name).toBe('Alpha');
    const m = await fakeDb.getMember(data.workspaceId, 'user-a');
    expect(m?.role).toBe('owner');
  });
});

// ----- handleGetWorkspace -----

describe('handleGetWorkspace', () => {
  it('returns 401 when unauthenticated', async () => {
    const wsId = await seed();
    const res  = await handleGetWorkspace(makeReq('GET'), wsId, deps());
    expect(res.status).toBe(401);
  });

  it('returns 404 when user is not a member', async () => {
    const wsId = await seed('W', 'user-a');
    const res  = await handleGetWorkspace(makeReq('GET'), wsId, deps('user-b'));
    expect(res.status).toBe(404);
  });

  it('returns workspace + members for a valid member', async () => {
    const wsId = await seed('My WS', 'user-a');
    const res  = await handleGetWorkspace(makeReq('GET'), wsId, deps('user-a'));
    const data = await res.json() as { ok: boolean; workspace: Workspace; members: WorkspaceMember[]; role: string };
    expect(data.ok).toBe(true);
    expect(data.workspace.name).toBe('My WS');
    expect(data.role).toBe('owner');
    expect(data.members).toHaveLength(1);
  });
});

// ----- handleUpdateWorkspace -----

describe('handleUpdateWorkspace', () => {
  it('returns 401 unauthenticated', async () => {
    const wsId = await seed();
    expect((await handleUpdateWorkspace(makeReq('PATCH', { name: 'X' }), wsId, deps())).status).toBe(401);
  });

  it('returns 403 for a plain member', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'member');
    const res = await handleUpdateWorkspace(makeReq('PATCH', { name: 'X' }), wsId, deps('user-b'));
    expect(res.status).toBe(403);
  });

  it('renames workspace for owner', async () => {
    const wsId = await seed('Old', 'user-a');
    const res  = await handleUpdateWorkspace(makeReq('PATCH', { name: 'New' }), wsId, deps('user-a'));
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
    expect((await fakeDb.getWorkspaceById(wsId))?.name).toBe('New');
  });
});

// ----- handleDeleteWorkspace -----

describe('handleDeleteWorkspace', () => {
  it('returns 403 for non-owner', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'admin');
    const res = await handleDeleteWorkspace(makeReq('DELETE'), wsId, deps('user-b'));
    expect(res.status).toBe(403);
  });

  it('returns 409 when other members exist', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'member');
    const res = await handleDeleteWorkspace(makeReq('DELETE'), wsId, deps('user-a'));
    expect(res.status).toBe(409);
  });

  it('deletes workspace when only owner remains', async () => {
    const wsId = await seed('W', 'user-a');
    const res  = await handleDeleteWorkspace(makeReq('DELETE'), wsId, deps('user-a'));
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
    expect(await fakeDb.getWorkspaceById(wsId)).toBeNull();
  });
});

// ----- handleListMembers -----

describe('handleListMembers', () => {
  it('returns 404 when not a member', async () => {
    const wsId = await seed('W', 'user-a');
    const res  = await handleListMembers(makeReq('GET'), wsId, deps('user-b'));
    expect(res.status).toBe(404);
  });

  it('returns member list', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'member');
    const res  = await handleListMembers(makeReq('GET'), wsId, deps('user-a'));
    const data = await res.json() as { members: WorkspaceMember[] };
    expect(data.members).toHaveLength(2);
  });
});

// ----- handleUpdateMember -----

describe('handleUpdateMember', () => {
  it('allows owner to promote a member to admin', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'member');
    const res = await handleUpdateMember(makeReq('PATCH', { role: 'admin' }), wsId, 'user-b', deps('user-a'));
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
    expect((await fakeDb.getMember(wsId, 'user-b'))?.role).toBe('admin');
  });

  it('returns 409 when changing own role', async () => {
    const wsId = await seed('W', 'user-a');
    const res  = await handleUpdateMember(makeReq('PATCH', { role: 'admin' }), wsId, 'user-a', deps('user-a'));
    expect(res.status).toBe(409);
  });

  it('returns 403 for non-owner', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'admin');
    await fakeDb.addMember(newId(), wsId, 'user-c', 'member');
    const res = await handleUpdateMember(makeReq('PATCH', { role: 'member' }), wsId, 'user-c', deps('user-b'));
    expect(res.status).toBe(403);
  });
});

// ----- handleRemoveMember -----

describe('handleRemoveMember', () => {
  it('allows owner to remove a member', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'member');
    const res = await handleRemoveMember(makeReq('DELETE'), wsId, 'user-b', deps('user-a'));
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
    expect(await fakeDb.getMember(wsId, 'user-b')).toBeNull();
  });

  it('returns 409 when trying to remove the owner', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'admin');
    const res = await handleRemoveMember(makeReq('DELETE'), wsId, 'user-a', deps('user-b'));
    expect(res.status).toBe(409);
  });

  it('allows a member to leave (remove themselves)', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'member');
    const res = await handleRemoveMember(makeReq('DELETE'), wsId, 'user-b', deps('user-b'));
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
  });
});

// ----- handleListInvitations -----

describe('handleListInvitations', () => {
  it('returns 403 for plain member', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.addMember(newId(), wsId, 'user-b', 'member');
    const res = await handleListInvitations(makeReq('GET'), wsId, deps('user-b'));
    expect(res.status).toBe(403);
  });

  it('returns pending invitations for owner', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.createInvitation('inv-1', wsId, 'x@y.com', 'member', 'h1', 'user-a', Date.now() + 86400000);
    const res  = await handleListInvitations(makeReq('GET'), wsId, deps('user-a'));
    const data = await res.json() as { invitations: unknown[] };
    expect(data.invitations).toHaveLength(1);
  });
});

// ----- handleRevokeInvitation -----

describe('handleRevokeInvitation', () => {
  it('revokes an invitation', async () => {
    const wsId = await seed('W', 'user-a');
    await fakeDb.createInvitation('inv-1', wsId, 'x@y.com', 'member', 'h1', 'user-a', Date.now() + 86400000);
    const res = await handleRevokeInvitation(makeReq('DELETE'), wsId, 'inv-1', deps('user-a'));
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
    expect(await fakeDb.findInvitationByTokenHash('h1')).toBeNull();
  });
});

// ----- handleBackfillWorkspaces -----

describe('handleBackfillWorkspaces', () => {
  it('returns 401 when secret is missing', async () => {
    const req = new Request('https://example.com', { method: 'POST' });
    const res = await handleBackfillWorkspaces(req, {
      db:     fakeDb,
      newId,
      secret: 'correct-secret',
      getUserEmail: async () => null,
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const req = new Request('https://example.com', {
      method:  'POST',
      headers: { 'X-Analyser-Secret': 'wrong' },
    });
    const res = await handleBackfillWorkspaces(req, {
      db:     fakeDb,
      newId,
      secret: 'correct-secret',
      getUserEmail: async () => null,
    });
    expect(res.status).toBe(401);
  });

  it('returns 405 for non-POST', async () => {
    const req = new Request('https://example.com', {
      method:  'GET',
      headers: { 'X-Analyser-Secret': 'correct-secret' },
    });
    const res = await handleBackfillWorkspaces(req, {
      db:     fakeDb,
      newId,
      secret: 'correct-secret',
      getUserEmail: async () => null,
    });
    expect(res.status).toBe(405);
  });

  it('reports zero created when no users need backfill', async () => {
    const req = new Request('https://example.com', {
      method:  'POST',
      headers: { 'X-Analyser-Secret': 'correct-secret' },
    });
    const res  = await handleBackfillWorkspaces(req, {
      db:     fakeDb,
      newId,
      secret: 'correct-secret',
      getUserEmail: async () => null,
    });
    const data = await res.json() as { ok: boolean; workspacesCreated: number };
    expect(data.ok).toBe(true);
    expect(data.workspacesCreated).toBe(0);
  });
});
