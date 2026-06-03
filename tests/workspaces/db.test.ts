import { describe, it, expect, beforeEach } from 'vitest';
import type { WorkspaceDb, Workspace, WorkspaceMember, WorkspaceInvitation, WorkspaceWithRole, WorkspaceRole } from '../../functions/_lib/workspaces/types';

// ---------------------------------------------------------------------------
// Map-backed fake WorkspaceDb
// ---------------------------------------------------------------------------

function makeFakeWorkspaceDb(): WorkspaceDb {
  const workspaces   = new Map<string, Workspace>();
  const members      = new Map<string, WorkspaceMember>();
  const invitations  = new Map<string, WorkspaceInvitation>();
  const docWorkspace = new Map<string, string>();
  const userDocs     = new Map<string, string[]>();

  const memberKey = (wsId: string, userId: string) => `${wsId}::${userId}`;

  return {
    createWorkspace: async (id, name, ownerId) => {
      const now = Date.now();
      workspaces.set(id, { id, name, owner_id: ownerId, created_at: now, updated_at: now });
    },

    getWorkspaceById: async (id) => workspaces.get(id) ?? null,

    listWorkspacesForUser: async (userId) => {
      const result: WorkspaceWithRole[] = [];
      for (const m of members.values()) {
        if (m.user_id !== userId) continue;
        const ws = workspaces.get(m.workspace_id);
        if (ws) result.push({ ...ws, role: m.role });
      }
      return result.sort((a, b) => b.updated_at - a.updated_at);
    },

    updateWorkspaceName: async (id, name) => {
      const ws = workspaces.get(id);
      if (ws) workspaces.set(id, { ...ws, name, updated_at: Date.now() });
    },

    deleteWorkspace: async (id) => { workspaces.delete(id); },

    addMember: async (id, workspaceId, userId, role) => {
      const now = Date.now();
      members.set(memberKey(workspaceId, userId), { id, workspace_id: workspaceId, user_id: userId, role, joined_at: now });
    },

    getMember: async (workspaceId, userId) => members.get(memberKey(workspaceId, userId)) ?? null,

    listMembers: async (workspaceId) =>
      [...members.values()]
        .filter(m => m.workspace_id === workspaceId)
        .sort((a, b) => a.joined_at - b.joined_at),

    updateMemberRole: async (workspaceId, userId, role) => {
      const m = members.get(memberKey(workspaceId, userId));
      if (m) members.set(memberKey(workspaceId, userId), { ...m, role });
    },

    removeMember: async (workspaceId, userId) => { members.delete(memberKey(workspaceId, userId)); },

    countMembers: async (workspaceId) =>
      [...members.values()].filter(m => m.workspace_id === workspaceId).length,

    createInvitation: async (id, workspaceId, email, role, tokenHash, invitedBy, expiresAt) => {
      const now = Date.now();
      invitations.set(id, { id, workspace_id: workspaceId, email, role, token_hash: tokenHash, invited_by: invitedBy, created_at: now, expires_at: expiresAt, accepted_at: null });
    },

    findInvitationByTokenHash: async (tokenHash) =>
      [...invitations.values()].find(i => i.token_hash === tokenHash) ?? null,

    findPendingInvitationByEmail: async (workspaceId, email) =>
      [...invitations.values()].find(i => i.workspace_id === workspaceId && i.email === email && i.accepted_at === null) ?? null,

    listPendingInvitations: async (workspaceId) =>
      [...invitations.values()]
        .filter(i => i.workspace_id === workspaceId && i.accepted_at === null)
        .sort((a, b) => b.created_at - a.created_at),

    acceptInvitation: async (id, acceptedAt) => {
      const inv = invitations.get(id);
      if (inv) invitations.set(id, { ...inv, accepted_at: acceptedAt });
    },

    deleteInvitation: async (id) => { invitations.delete(id); },

    listUserIdsWithNoMembership: async () => {
      const memberUserIds = new Set([...members.values()].map(m => m.user_id));
      return Array.from(userDocs.keys()).filter(uid => !memberUserIds.has(uid));
    },

    listDocumentIdsByUser: async (userId) => userDocs.get(userId) ?? [],

    setDocumentWorkspace: async (documentId, workspaceId) => { docWorkspace.set(documentId, workspaceId); },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkspaceDb (fake)', () => {
  let db: WorkspaceDb;

  beforeEach(() => { db = makeFakeWorkspaceDb(); });

  it('creates and retrieves a workspace', async () => {
    await db.createWorkspace('ws-1', 'My Workspace', 'user-a');
    const ws = await db.getWorkspaceById('ws-1');
    expect(ws?.name).toBe('My Workspace');
    expect(ws?.owner_id).toBe('user-a');
  });

  it('returns null for missing workspace', async () => {
    expect(await db.getWorkspaceById('no-such')).toBeNull();
  });

  it('adds and retrieves members', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.addMember('m1', 'ws-1', 'user-a', 'owner');
    await db.addMember('m2', 'ws-1', 'user-b', 'member');

    const m = await db.getMember('ws-1', 'user-a');
    expect(m?.role).toBe('owner');
    expect(await db.countMembers('ws-1')).toBe(2);
  });

  it('lists workspaces for a user', async () => {
    await db.createWorkspace('ws-1', 'W1', 'user-a');
    await db.createWorkspace('ws-2', 'W2', 'user-b');
    await db.addMember('m1', 'ws-1', 'user-a', 'owner');
    await db.addMember('m2', 'ws-2', 'user-b', 'owner');
    await db.addMember('m3', 'ws-2', 'user-a', 'member');

    const list = await db.listWorkspacesForUser('user-a');
    expect(list).toHaveLength(2);
    expect(list.map(w => w.id)).toContain('ws-1');
    expect(list.map(w => w.id)).toContain('ws-2');
    const roleForWs2 = list.find(w => w.id === 'ws-2')?.role;
    expect(roleForWs2).toBe('member');
  });

  it('updates workspace name', async () => {
    await db.createWorkspace('ws-1', 'Old', 'user-a');
    await db.updateWorkspaceName('ws-1', 'New');
    expect((await db.getWorkspaceById('ws-1'))?.name).toBe('New');
  });

  it('deletes a workspace', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.deleteWorkspace('ws-1');
    expect(await db.getWorkspaceById('ws-1')).toBeNull();
  });

  it('removes a member', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.addMember('m1', 'ws-1', 'user-a', 'owner');
    await db.addMember('m2', 'ws-1', 'user-b', 'member');
    await db.removeMember('ws-1', 'user-b');
    expect(await db.getMember('ws-1', 'user-b')).toBeNull();
    expect(await db.countMembers('ws-1')).toBe(1);
  });

  it('updates member role', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.addMember('m1', 'ws-1', 'user-b', 'member');
    await db.updateMemberRole('ws-1', 'user-b', 'admin');
    expect((await db.getMember('ws-1', 'user-b'))?.role).toBe('admin');
  });

  it('creates and finds invitations by token hash', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.createInvitation('inv-1', 'ws-1', 'bob@example.com', 'member', 'hash-abc', 'user-a', Date.now() + 86400000);

    const inv = await db.findInvitationByTokenHash('hash-abc');
    expect(inv?.email).toBe('bob@example.com');
    expect(inv?.accepted_at).toBeNull();
  });

  it('lists only pending invitations', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.createInvitation('inv-1', 'ws-1', 'a@x.com', 'member', 'h1', 'user-a', Date.now() + 86400000);
    await db.createInvitation('inv-2', 'ws-1', 'b@x.com', 'admin',  'h2', 'user-a', Date.now() + 86400000);
    await db.acceptInvitation('inv-1', Date.now());

    const pending = await db.listPendingInvitations('ws-1');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.email).toBe('b@x.com');
  });

  it('accepts an invitation', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.createInvitation('inv-1', 'ws-1', 'c@x.com', 'member', 'h3', 'user-a', Date.now() + 86400000);
    await db.acceptInvitation('inv-1', 12345);
    const inv = await db.findInvitationByTokenHash('h3');
    expect(inv?.accepted_at).toBe(12345);
  });

  it('finds pending invitation by email', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.createInvitation('inv-1', 'ws-1', 'd@x.com', 'member', 'h4', 'user-a', Date.now() + 86400000);
    expect(await db.findPendingInvitationByEmail('ws-1', 'd@x.com')).not.toBeNull();
    expect(await db.findPendingInvitationByEmail('ws-1', 'other@x.com')).toBeNull();
  });

  it('deletes invitation', async () => {
    await db.createWorkspace('ws-1', 'W', 'user-a');
    await db.createInvitation('inv-1', 'ws-1', 'e@x.com', 'member', 'h5', 'user-a', Date.now() + 86400000);
    await db.deleteInvitation('inv-1');
    expect(await db.findInvitationByTokenHash('h5')).toBeNull();
  });
});
