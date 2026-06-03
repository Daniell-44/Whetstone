import { describe, it, expect } from 'vitest';
import { userHasActiveSubscriptionViaWorkspace, canManageWorkspace, isOwner } from '../../functions/_lib/workspaces/permissions';
import type { BillingDb, DbUserWithSubscription } from '../../functions/_lib/billing/types';
import type { WorkspaceDb, WorkspaceWithRole, WorkspaceMember, WorkspaceInvitation, Workspace, WorkspaceRole } from '../../functions/_lib/workspaces/types';

// ---------------------------------------------------------------------------
// Minimal fakes
// ---------------------------------------------------------------------------

const FUTURE_MS = Date.now() + 30 * 24 * 60 * 60 * 1000;
const PAST_MS   = Date.now() - 1;

function makeBillingDb(subscriptionsByUserId: Record<string, { status: string; end: number }>): BillingDb {
  return {
    getUserWithSubscription: async (userId) => {
      const sub = subscriptionsByUserId[userId];
      if (!sub) return null;
      return {
        id:                              userId,
        email:                           `${userId}@example.com`,
        stripe_customer_id:              null,
        stripe_subscription_id:          null,
        subscription_status:             sub.status,
        subscription_current_period_end: sub.end,
        subscription_updated_at:         null,
      };
    },
    updateStripeCustomerId:    async () => {},
    upsertSubscription:        async () => {},
    findUserByStripeCustomerId: async () => null,
  };
}

function makeWorkspaceDb(
  membersByUserId: Record<string, Array<{ workspaceId: string; role: WorkspaceRole }>>,
  membersByWorkspace: Record<string, Array<{ userId: string; role: WorkspaceRole }>>,
): WorkspaceDb {
  return {
    createWorkspace:           async () => {},
    getWorkspaceById:          async () => null,
    listWorkspacesForUser:     async (userId) => {
      const wsList = membersByUserId[userId] ?? [];
      return wsList.map(m => ({ id: m.workspaceId, name: 'W', owner_id: userId, created_at: 0, updated_at: 0, role: m.role }));
    },
    updateWorkspaceName:       async () => {},
    deleteWorkspace:           async () => {},
    addMember:                 async () => {},
    getMember:                 async () => null,
    listMembers:               async (workspaceId) =>
      (membersByWorkspace[workspaceId] ?? []).map((m, i) => ({
        id: `m${i}`, workspace_id: workspaceId, user_id: m.userId, role: m.role, joined_at: 0,
      })),
    updateMemberRole:          async () => {},
    removeMember:              async () => {},
    countMembers:              async () => 0,
    createInvitation:          async () => {},
    findInvitationByTokenHash: async () => null,
    findPendingInvitationByEmail: async () => null,
    listPendingInvitations:    async () => [],
    acceptInvitation:          async () => {},
    deleteInvitation:          async () => {},
    listUserIdsWithNoMembership: async () => [],
    listDocumentIdsByUser:     async () => [],
    setDocumentWorkspace:      async () => {},
  };
}

// ---------------------------------------------------------------------------
// userHasActiveSubscriptionViaWorkspace
// ---------------------------------------------------------------------------

describe('userHasActiveSubscriptionViaWorkspace', () => {
  it('returns true when the user directly has an active subscription', async () => {
    const billing   = makeBillingDb({ 'user-a': { status: 'active', end: FUTURE_MS } });
    const workspace = makeWorkspaceDb({}, {});
    expect(await userHasActiveSubscriptionViaWorkspace(billing, workspace, 'user-a')).toBe(true);
  });

  it('returns false when neither user nor any workspace member has a subscription', async () => {
    const billing   = makeBillingDb({});
    const workspace = makeWorkspaceDb(
      { 'user-a': [{ workspaceId: 'ws-1', role: 'member' }] },
      { 'ws-1':   [{ userId: 'user-a', role: 'member' }, { userId: 'user-b', role: 'owner' }] },
    );
    expect(await userHasActiveSubscriptionViaWorkspace(billing, workspace, 'user-a')).toBe(false);
  });

  it('returns true when a workspace co-member has an active subscription', async () => {
    const billing   = makeBillingDb({ 'user-b': { status: 'active', end: FUTURE_MS } });
    const workspace = makeWorkspaceDb(
      { 'user-a': [{ workspaceId: 'ws-1', role: 'member' }] },
      { 'ws-1':   [{ userId: 'user-a', role: 'member' }, { userId: 'user-b', role: 'owner' }] },
    );
    expect(await userHasActiveSubscriptionViaWorkspace(billing, workspace, 'user-a')).toBe(true);
  });

  it('returns false when co-member subscription is expired', async () => {
    const billing   = makeBillingDb({ 'user-b': { status: 'active', end: PAST_MS } });
    const workspace = makeWorkspaceDb(
      { 'user-a': [{ workspaceId: 'ws-1', role: 'member' }] },
      { 'ws-1':   [{ userId: 'user-a', role: 'member' }, { userId: 'user-b', role: 'owner' }] },
    );
    expect(await userHasActiveSubscriptionViaWorkspace(billing, workspace, 'user-a')).toBe(false);
  });

  it('returns false when user has no workspaces and no direct subscription', async () => {
    const billing   = makeBillingDb({});
    const workspace = makeWorkspaceDb({}, {});
    expect(await userHasActiveSubscriptionViaWorkspace(billing, workspace, 'user-x')).toBe(false);
  });

  it('checks across multiple workspaces and short-circuits on first subscribed member', async () => {
    const billing   = makeBillingDb({ 'user-c': { status: 'active', end: FUTURE_MS } });
    const workspace = makeWorkspaceDb(
      { 'user-a': [{ workspaceId: 'ws-1', role: 'member' }, { workspaceId: 'ws-2', role: 'admin' }] },
      {
        'ws-1': [{ userId: 'user-a', role: 'member' }],
        'ws-2': [{ userId: 'user-a', role: 'admin' }, { userId: 'user-c', role: 'owner' }],
      },
    );
    expect(await userHasActiveSubscriptionViaWorkspace(billing, workspace, 'user-a')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canManageWorkspace / isOwner
// ---------------------------------------------------------------------------

describe('canManageWorkspace', () => {
  it('returns true for owner and admin', () => {
    expect(canManageWorkspace('owner')).toBe(true);
    expect(canManageWorkspace('admin')).toBe(true);
  });
  it('returns false for member', () => {
    expect(canManageWorkspace('member')).toBe(false);
  });
});

describe('isOwner', () => {
  it('returns true only for owner', () => {
    expect(isOwner('owner')).toBe(true);
    expect(isOwner('admin')).toBe(false);
    expect(isOwner('member')).toBe(false);
  });
});
