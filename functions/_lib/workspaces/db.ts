import type { Workspace, WorkspaceMember, WorkspaceInvitation, WorkspaceWithRole, WorkspaceRole, WorkspaceDb } from './types';

export function makeWorkspaceDb(d1: D1Database): WorkspaceDb {
  return {
    createWorkspace: async (id, name, ownerId) => {
      const now = Date.now();
      await d1
        .prepare('INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, name, ownerId, now, now)
        .run();
    },

    getWorkspaceById: (id) =>
      d1.prepare('SELECT * FROM workspaces WHERE id = ?').bind(id).first<Workspace>(),

    listWorkspacesForUser: async (userId) => {
      const result = await d1
        .prepare(`
          SELECT w.*, wm.role
          FROM workspaces w
          JOIN workspace_members wm ON wm.workspace_id = w.id
          WHERE wm.user_id = ?
          ORDER BY w.updated_at DESC
        `)
        .bind(userId)
        .all<WorkspaceWithRole>();
      return result.results;
    },

    updateWorkspaceName: async (id, name) => {
      const now = Date.now();
      await d1
        .prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?')
        .bind(name, now, id)
        .run();
    },

    deleteWorkspace: async (id) => {
      await d1.prepare('DELETE FROM workspaces WHERE id = ?').bind(id).run();
    },

    addMember: async (id, workspaceId, userId, role) => {
      const now = Date.now();
      await d1
        .prepare('INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, workspaceId, userId, role, now)
        .run();
    },

    getMember: (workspaceId, userId) =>
      d1
        .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(workspaceId, userId)
        .first<WorkspaceMember>(),

    listMembers: async (workspaceId) => {
      const result = await d1
        .prepare('SELECT * FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC')
        .bind(workspaceId)
        .all<WorkspaceMember>();
      return result.results;
    },

    updateMemberRole: async (workspaceId, userId, role) => {
      await d1
        .prepare('UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?')
        .bind(role, workspaceId, userId)
        .run();
    },

    removeMember: async (workspaceId, userId) => {
      await d1
        .prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
        .bind(workspaceId, userId)
        .run();
    },

    countMembers: async (workspaceId) => {
      const row = await d1
        .prepare('SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = ?')
        .bind(workspaceId)
        .first<{ count: number }>();
      return row?.count ?? 0;
    },

    createInvitation: async (id, workspaceId, email, role, tokenHash, invitedBy, expiresAt) => {
      const now = Date.now();
      await d1
        .prepare(`
          INSERT INTO workspace_invitations
            (id, workspace_id, email, role, token_hash, invited_by, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(id, workspaceId, email, role, tokenHash, invitedBy, now, expiresAt)
        .run();
    },

    findInvitationByTokenHash: (tokenHash) =>
      d1
        .prepare('SELECT * FROM workspace_invitations WHERE token_hash = ?')
        .bind(tokenHash)
        .first<WorkspaceInvitation>(),

    findPendingInvitationByEmail: (workspaceId, email) =>
      d1
        .prepare(`
          SELECT * FROM workspace_invitations
          WHERE workspace_id = ? AND email = ? AND accepted_at IS NULL
          LIMIT 1
        `)
        .bind(workspaceId, email)
        .first<WorkspaceInvitation>(),

    listPendingInvitations: async (workspaceId) => {
      const result = await d1
        .prepare(`
          SELECT * FROM workspace_invitations
          WHERE workspace_id = ? AND accepted_at IS NULL
          ORDER BY created_at DESC
        `)
        .bind(workspaceId)
        .all<WorkspaceInvitation>();
      return result.results;
    },

    acceptInvitation: async (id, acceptedAt) => {
      await d1
        .prepare('UPDATE workspace_invitations SET accepted_at = ? WHERE id = ?')
        .bind(acceptedAt, id)
        .run();
    },

    deleteInvitation: async (id) => {
      await d1.prepare('DELETE FROM workspace_invitations WHERE id = ?').bind(id).run();
    },

    listUserIdsWithNoMembership: async () => {
      const result = await d1
        .prepare(`
          SELECT u.id FROM users u
          WHERE NOT EXISTS (
            SELECT 1 FROM workspace_members wm WHERE wm.user_id = u.id
          )
        `)
        .all<{ id: string }>();
      return result.results.map(r => r.id);
    },

    listDocumentIdsByUser: async (userId) => {
      const result = await d1
        .prepare("SELECT id FROM documents WHERE user_id = ? AND status = 'active'")
        .bind(userId)
        .all<{ id: string }>();
      return result.results.map(r => r.id);
    },

    setDocumentWorkspace: async (documentId, workspaceId) => {
      await d1
        .prepare('UPDATE documents SET workspace_id = ? WHERE id = ?')
        .bind(workspaceId, documentId)
        .run();
    },
  };
}
