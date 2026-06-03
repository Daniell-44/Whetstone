import type { BillingDb } from '../billing/types';
import { userHasActiveSubscription } from '../billing/subscription';
import type { WorkspaceDb, WorkspaceRole } from './types';

// ---------------------------------------------------------------------------
// Subscription check — workspace-aware
// ---------------------------------------------------------------------------

// Returns true if the user themselves or any member of any workspace they
// belong to has an active subscription.
export async function userHasActiveSubscriptionViaWorkspace(
  billingDb:   BillingDb,
  workspaceDb: WorkspaceDb,
  userId:      string,
): Promise<boolean> {
  if (await userHasActiveSubscription(billingDb, userId)) return true;

  const workspaces = await workspaceDb.listWorkspacesForUser(userId);
  for (const ws of workspaces) {
    const members = await workspaceDb.listMembers(ws.id);
    for (const m of members) {
      if (m.user_id === userId) continue; // already checked above
      if (await userHasActiveSubscription(billingDb, m.user_id)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Membership helpers
// ---------------------------------------------------------------------------

export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isOwner(role: WorkspaceRole): boolean {
  return role === 'owner';
}
