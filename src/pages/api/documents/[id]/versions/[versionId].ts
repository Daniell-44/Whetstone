export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../../functions/_lib/auth/db';
import { makeDocumentDb } from '../../../../../../functions/_lib/documents/db';
import { getSessionFromRequest } from '../../../../../../functions/_lib/auth/sessions';

// GET /api/documents/[id]/versions/[versionId]
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

  const version = await docDb.getVersion(params.versionId!);
  if (!version || version.document_id !== params.id) {
    return new Response(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true, version }), { headers: { 'Content-Type': 'application/json' } });
};
