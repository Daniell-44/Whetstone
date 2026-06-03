import { z } from 'zod';
import type { WorkspaceDb, WorkspaceRole } from './types';
import { canManageWorkspace, isOwner } from './permissions';
import type { WorkspaceInvitationSender } from '../auth/email';
import { generateOpaqueToken, hashToken, generateId } from '../auth/tokens';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Shared deps types
// ---------------------------------------------------------------------------

type Session = { userId: string };

export interface WorkspaceHandlerDeps {
  db:         WorkspaceDb;
  getSession: (req: Request) => Promise<Session | null>;
  newId:      () => string;
}

// ---------------------------------------------------------------------------
// GET /api/workspaces — list workspaces for the authenticated user
// ---------------------------------------------------------------------------

export async function handleListWorkspaces(
  req:  Request,
  deps: WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const workspaces = await deps.db.listWorkspacesForUser(session.userId);
  return json({ ok: true, workspaces });
}

// ---------------------------------------------------------------------------
// POST /api/workspaces — create a workspace (user becomes the owner)
// ---------------------------------------------------------------------------

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function handleCreateWorkspace(
  req:  Request,
  deps: WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = CreateWorkspaceSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  const workspaceId = deps.newId();
  const memberId    = deps.newId();
  await deps.db.createWorkspace(workspaceId, parsed.data.name, session.userId);
  await deps.db.addMember(memberId, workspaceId, session.userId, 'owner');

  return json({ ok: true, workspaceId });
}

// ---------------------------------------------------------------------------
// GET /api/workspaces/[id] — get workspace details + members
// ---------------------------------------------------------------------------

export async function handleGetWorkspace(
  req:         Request,
  workspaceId: string,
  deps:        WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const member = await deps.db.getMember(workspaceId, session.userId);
  if (!member) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);

  const workspace = await deps.db.getWorkspaceById(workspaceId);
  if (!workspace) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);

  const members = await deps.db.listMembers(workspaceId);
  return json({ ok: true, workspace, members, role: member.role });
}

// ---------------------------------------------------------------------------
// PATCH /api/workspaces/[id] — rename workspace (owner/admin only)
// ---------------------------------------------------------------------------

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function handleUpdateWorkspace(
  req:         Request,
  workspaceId: string,
  deps:        WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const member = await deps.db.getMember(workspaceId, session.userId);
  if (!member) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);
  if (!canManageWorkspace(member.role)) {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only owners and admins can rename a workspace' } }, 403);
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = UpdateWorkspaceSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  await deps.db.updateWorkspaceName(workspaceId, parsed.data.name);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// DELETE /api/workspaces/[id] — delete workspace (owner only)
// ---------------------------------------------------------------------------

export async function handleDeleteWorkspace(
  req:         Request,
  workspaceId: string,
  deps:        WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const member = await deps.db.getMember(workspaceId, session.userId);
  if (!member) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);
  if (!isOwner(member.role)) {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only the owner can delete a workspace' } }, 403);
  }

  const count = await deps.db.countMembers(workspaceId);
  if (count > 1) {
    return json({ ok: false, error: { code: 'CONFLICT', message: 'Remove all other members before deleting the workspace' } }, 409);
  }

  await deps.db.deleteWorkspace(workspaceId);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// GET /api/workspaces/[id]/members — list members
// ---------------------------------------------------------------------------

export async function handleListMembers(
  req:         Request,
  workspaceId: string,
  deps:        WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const member = await deps.db.getMember(workspaceId, session.userId);
  if (!member) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);

  const members = await deps.db.listMembers(workspaceId);
  return json({ ok: true, members });
}

// ---------------------------------------------------------------------------
// PATCH /api/workspaces/[id]/members/[memberUserId] — update member role
// ---------------------------------------------------------------------------

const UpdateMemberSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export async function handleUpdateMember(
  req:            Request,
  workspaceId:    string,
  memberUserId:   string,
  deps:           WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const actorMember = await deps.db.getMember(workspaceId, session.userId);
  if (!actorMember) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);
  if (!isOwner(actorMember.role)) {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only the owner can change member roles' } }, 403);
  }

  if (memberUserId === session.userId) {
    return json({ ok: false, error: { code: 'CONFLICT', message: 'Cannot change your own role' } }, 409);
  }

  const target = await deps.db.getMember(workspaceId, memberUserId);
  if (!target) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = UpdateMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  await deps.db.updateMemberRole(workspaceId, memberUserId, parsed.data.role);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// DELETE /api/workspaces/[id]/members/[memberUserId] — remove a member
// ---------------------------------------------------------------------------

export async function handleRemoveMember(
  req:          Request,
  workspaceId:  string,
  memberUserId: string,
  deps:         WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const actorMember = await deps.db.getMember(workspaceId, session.userId);
  if (!actorMember) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);

  const isSelf  = memberUserId === session.userId;
  const canKick = canManageWorkspace(actorMember.role);

  if (!isSelf && !canKick) {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only owners and admins can remove members' } }, 403);
  }

  const target = await deps.db.getMember(workspaceId, memberUserId);
  if (!target) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Member not found' } }, 404);

  if (isOwner(target.role)) {
    return json({ ok: false, error: { code: 'CONFLICT', message: 'Cannot remove the workspace owner' } }, 409);
  }

  await deps.db.removeMember(workspaceId, memberUserId);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// GET /api/workspaces/[id]/invitations — list pending invitations
// ---------------------------------------------------------------------------

export async function handleListInvitations(
  req:         Request,
  workspaceId: string,
  deps:        WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const member = await deps.db.getMember(workspaceId, session.userId);
  if (!member) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);
  if (!canManageWorkspace(member.role)) {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only owners and admins can view invitations' } }, 403);
  }

  const invitations = await deps.db.listPendingInvitations(workspaceId);
  return json({ ok: true, invitations: invitations.map(i => ({ id: i.id, email: i.email, role: i.role, created_at: i.created_at, expires_at: i.expires_at })) });
}

// ---------------------------------------------------------------------------
// POST /api/workspaces/[id]/invitations — create an invitation
// ---------------------------------------------------------------------------

export interface CreateInvitationDeps extends WorkspaceHandlerDeps {
  sendInvitation: WorkspaceInvitationSender;
  siteUrl:        string;
}

const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role:  z.enum(['admin', 'member']).default('member'),
});

export async function handleCreateInvitation(
  req:         Request,
  workspaceId: string,
  deps:        CreateInvitationDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const member = await deps.db.getMember(workspaceId, session.userId);
  if (!member) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);
  if (!canManageWorkspace(member.role)) {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only owners and admins can invite members' } }, 403);
  }

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = CreateInvitationSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  const email = parsed.data.email.toLowerCase();

  // Don't allow inviting an existing member.
  const workspace = await deps.db.getWorkspaceById(workspaceId);
  if (!workspace) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);

  // Check for existing pending invitation.
  const existing = await deps.db.findPendingInvitationByEmail(workspaceId, email);
  if (existing && existing.expires_at > Date.now()) {
    return json({ ok: false, error: { code: 'CONFLICT', message: 'An invitation for this email is already pending' } }, 409);
  }

  const token      = generateOpaqueToken();
  const tokenHash  = await hashToken(token);
  const invId      = deps.newId();
  const expiresAt  = Date.now() + INVITATION_TTL_MS;

  await deps.db.createInvitation(invId, workspaceId, email, parsed.data.role, tokenHash, session.userId, expiresAt);

  const acceptUrl = `${deps.siteUrl}/api/workspaces/invitations/accept?token=${token}`;
  try {
    await deps.sendInvitation(email, workspace.name, session.userId, acceptUrl);
  } catch {
    // Best-effort — invitation is created even if email fails.
  }

  return json({ ok: true, invitationId: invId });
}

// ---------------------------------------------------------------------------
// DELETE /api/workspaces/[id]/invitations/[invId] — revoke an invitation
// ---------------------------------------------------------------------------

export async function handleRevokeInvitation(
  req:         Request,
  workspaceId: string,
  invId:       string,
  deps:        WorkspaceHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const member = await deps.db.getMember(workspaceId, session.userId);
  if (!member) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, 404);
  if (!canManageWorkspace(member.role)) {
    return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Only owners and admins can revoke invitations' } }, 403);
  }

  await deps.db.deleteInvitation(invId);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// GET /api/workspaces/invitations/accept?token= — accept an invitation
// ---------------------------------------------------------------------------

export interface AcceptInvitationDeps {
  db:         WorkspaceDb;
  getSession: (req: Request) => Promise<Session | null>;
  newId:      () => string;
  siteUrl:    string;
}

export async function handleAcceptInvitation(
  req:  Request,
  deps: AcceptInvitationDeps,
): Promise<Response> {
  const url   = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(null, { status: 302, headers: { Location: `${deps.siteUrl}/login?error=invalid_invitation` } });
  }

  const tokenHash  = await hashToken(token);
  const invitation = await deps.db.findInvitationByTokenHash(tokenHash);

  if (!invitation || invitation.accepted_at !== null || invitation.expires_at < Date.now()) {
    return new Response(null, { status: 302, headers: { Location: `${deps.siteUrl}/login?error=invalid_invitation` } });
  }

  const session = await deps.getSession(req);
  if (!session) {
    // Redirect to login, preserving the token so after sign-in they can re-hit this URL.
    const returnTo = encodeURIComponent(`/api/workspaces/invitations/accept?token=${token}`);
    return new Response(null, { status: 302, headers: { Location: `${deps.siteUrl}/login?returnTo=${returnTo}` } });
  }

  // Accept.
  const existingMember = await deps.db.getMember(invitation.workspace_id, session.userId);
  if (!existingMember) {
    const memberId = deps.newId();
    await deps.db.addMember(memberId, invitation.workspace_id, session.userId, invitation.role);
  }
  await deps.db.acceptInvitation(invitation.id, Date.now());

  return new Response(null, {
    status: 302,
    headers: { Location: `${deps.siteUrl}/workspaces/${invitation.workspace_id}/settings?joined=1` },
  });
}

// ---------------------------------------------------------------------------
// POST /api/admin/backfill-workspaces — idempotent backfill
// ---------------------------------------------------------------------------

export interface BackfillDeps {
  db:      WorkspaceDb;
  newId:   () => string;
  secret:  string | undefined;
  getUserEmail: (userId: string) => Promise<string | null>;
}

export async function handleBackfillWorkspaces(
  req:  Request,
  deps: BackfillDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
  }

  const providedSecret = req.headers.get('X-Analyser-Secret');
  if (!deps.secret || providedSecret !== deps.secret) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED' } }, 401);
  }

  const userIds = await deps.db.listUserIdsWithNoMembership();
  let created = 0;

  for (const userId of userIds) {
    const email       = await deps.getUserEmail(userId);
    const name        = email ? `${email}'s Workspace` : 'Personal Workspace';
    const workspaceId = deps.newId();
    const memberId    = deps.newId();

    await deps.db.createWorkspace(workspaceId, name, userId);
    await deps.db.addMember(memberId, workspaceId, userId, 'owner');

    const docIds = await deps.db.listDocumentIdsByUser(userId);
    for (const docId of docIds) {
      await deps.db.setDocumentWorkspace(docId, workspaceId);
    }
    created++;
  }

  return json({ ok: true, workspacesCreated: created });
}
