export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../../functions/_lib/auth/db';
import { makeDocumentDb } from '../../../../../../functions/_lib/documents/db';
import { handleCreateVersion } from '../../../../../../functions/_lib/documents/handlers';
import { getSessionFromRequest } from '../../../../../../functions/_lib/auth/sessions';

function newId() { return crypto.randomUUID(); }

// GET /api/documents/[id]/versions
export const GET: APIRoute = async ({ request, params }) => {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) {
    return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const docDb   = makeDocumentDb(env.DB);
  const doc     = await docDb.getDocumentById(params.id!);
  if (!doc || doc.user_id !== session.user_id) {
    return new Response(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const versions = await docDb.listVersions(params.id!);
  return new Response(JSON.stringify({ ok: true, versions }), { headers: { 'Content-Type': 'application/json' } });
};

// POST /api/documents/[id]/versions — create new version
export const POST: APIRoute = async ({ request, params }) => {
  const authDb = makeAuthDb(env.DB);
  const docDb  = makeDocumentDb(env.DB);

  return handleCreateVersion(request, params.id!, {
    db:         docDb,
    getSession: (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    newId,
  });
};
