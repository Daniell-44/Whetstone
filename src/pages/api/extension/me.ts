export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeBillingDb, getUserSubscription } from '../../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../../functions/_lib/workspaces/permissions';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

// ---------------------------------------------------------------------------
// /api/extension/me — extension-friendly session probe
//
// Used by the Chrome extension to determine whether a Whetstone account is
// connected via cookie session, and whether that account has an active
// subscription (for Reader Pro tier gating). Always returns 200 with a
// boolean payload — no 401 — so the extension can handle "not connected" as
// the normal case rather than as an error.
//
// CORS: allowlists the extension origin (chrome-extension://<id>) via wildcard
// origin since Chrome extension IDs change per build. Credentials must be
// included by the extension fetch.
// ---------------------------------------------------------------------------

function corsHeaders(originHeader: string | null): Record<string, string> {
  // Only echo back chrome-extension:// origins — never arbitrary web origins.
  // Cookies will not be sent cross-origin unless Access-Control-Allow-Credentials is true
  // AND the origin is explicitly named (not '*'). So we echo the origin if it's a Chrome ext.
  const origin = originHeader && originHeader.startsWith('chrome-extension://')
    ? originHeader
    : '';
  return {
    'Access-Control-Allow-Origin':      origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type',
    'Vary':                              'Origin',
  };
}

function json(body: unknown, status = 200, originHeader: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(originHeader),
    },
  });
}

export async function OPTIONS({ request }: APIContext) {
  return new Response(null, {
    status:  204,
    headers: corsHeaders(request.headers.get('Origin')),
  });
}

export async function GET({ request }: APIContext) {
  const origin  = request.headers.get('Origin');
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);

  if (!session) {
    return json({ connected: false }, 200, origin);
  }

  const user = await authDb.findUserById(session.user_id);
  if (!user) {
    return json({ connected: false }, 200, origin);
  }

  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);

  const hasPro = await userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, user.id);
  const sub    = await getUserSubscription(billingDb, user.id);

  return json({
    connected:   true,
    email:       user.email,
    pro:         hasPro,
    status:      sub?.status ?? null,
    periodEndMs: sub?.currentPeriodEnd ?? null,
  }, 200, origin);
}
