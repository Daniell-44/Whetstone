export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id:         string;
  name:       string;
  owner_id:   string;
  created_at: number;
  updated_at: number;
}

export interface WorkspaceMember {
  id:           string;
  workspace_id: string;
  user_id:      string;
  role:         WorkspaceRole;
  joined_at:    number;
}

export interface WorkspaceInvitation {
  id:           string;
  workspace_id: string;
  email:        string;
  role:         'admin' | 'member';
  token_hash:   string;
  invited_by:   string;
  created_at:   number;
  expires_at:   number;
  accepted_at:  number | null;
}

export interface WorkspaceWithRole extends Workspace {
  role: WorkspaceRole;
}

export interface WorkspaceDb {
  createWorkspace(id: string, name: string, ownerId: string): Promise<void>;
  getWorkspaceById(id: string): Promise<Workspace | null>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]>;
  updateWorkspaceName(id: string, name: string): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;

  addMember(id: string, workspaceId: string, userId: string, role: WorkspaceRole): Promise<void>;
  getMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  listMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  countMembers(workspaceId: string): Promise<number>;

  createInvitation(id: string, workspaceId: string, email: string, role: 'admin' | 'member', tokenHash: string, invitedBy: string, expiresAt: number): Promise<void>;
  findInvitationByTokenHash(tokenHash: string): Promise<WorkspaceInvitation | null>;
  findPendingInvitationByEmail(workspaceId: string, email: string): Promise<WorkspaceInvitation | null>;
  listPendingInvitations(workspaceId: string): Promise<WorkspaceInvitation[]>;
  acceptInvitation(id: string, acceptedAt: number): Promise<void>;
  deleteInvitation(id: string): Promise<void>;

  listUserIdsWithNoMembership(): Promise<string[]>;
  listDocumentIdsByUser(userId: string): Promise<string[]>;
  setDocumentWorkspace(documentId: string, workspaceId: string): Promise<void>;
}
