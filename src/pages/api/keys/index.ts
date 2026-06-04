export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../../functions/_lib/workspaces/permissions';
import { makeApiKeyDb } from '../../../../functions/_lib/api-keys/db';
import { handleListKeys, handleCreateKey } from '../../../../functions/_lib/api-keys/handler';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

async function getAuthedUser(request: Request) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return null;
  return session.user_id;
}

async function hasSubscription(userId: string): Promise<boolean> {
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId);
}

function forbidden() {
  return new Response(JSON.stringify({ ok: false, error: 'Subscription required' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauth() {
  return new Response(JSON.stringify({ ok: false, error: 'Unauthorised' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET({ request }: APIContext) {
  const userId = await getAuthedUser(request);
  if (!userId) return unauth();
  if (!await hasSubscription(userId)) return forbidden();
  return handleListKeys(userId, makeApiKeyDb(env.DB));
}

export async function POST({ request }: APIContext) {
  const userId = await getAuthedUser(request);
  if (!userId) return unauth();
  if (!await hasSubscription(userId)) return forbidden();
  return handleCreateKey(request, userId, makeApiKeyDb(env.DB));
}
