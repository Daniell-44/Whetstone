export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../../functions/_lib/billing/subscription';
import { makeDocumentDb } from '../../../../functions/_lib/documents/db';
import { handleCreateDocument } from '../../../../functions/_lib/documents/handlers';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { makeWorkspaceDb } from '../../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../../functions/_lib/workspaces/permissions';

function newId() { return crypto.randomUUID(); }

// GET /api/documents — list the authenticated user's active documents
export const GET: APIRoute = async ({ request }) => {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) {
    return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const docDb     = makeDocumentDb(env.DB);
  const documents = await docDb.listActiveDocumentsForUser(session.user_id);
  return new Response(JSON.stringify({ ok: true, documents }), { headers: { 'Content-Type': 'application/json' } });
};

// POST /api/documents — create a document + first version
export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  const docDb       = makeDocumentDb(env.DB);

  return handleCreateDocument(request, {
    db:                docDb,
    getSession:        (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
    newId,
  });
};
