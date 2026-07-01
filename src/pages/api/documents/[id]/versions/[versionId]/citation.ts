export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../../../functions/_lib/auth/db';
import { makeDocumentDb } from '../../../../../../../functions/_lib/documents/db';
import { getSessionFromRequest } from '../../../../../../../functions/_lib/auth/sessions';
import { CitationAuditResultSchema } from '../../../../../../../functions/_lib/citation-audit/schemas';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Persist a citation-audit result onto a document version. Citation runs via
// the non-version /api/citation-audit endpoint, so the Studio client posts the
// result here after it completes — this is what lets a reopened draft rehydrate
// its Source Match panel instead of losing it (build #2).
export const POST: APIRoute = async ({ request, params }) => {
  const authDb  = makeAuthDb(env.DB);
  const docDb   = makeDocumentDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const docId     = params.id!;
  const versionId = params.versionId!;

  const doc = await docDb.getDocumentById(docId);
  if (!doc || doc.user_id !== session.user_id) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }
  const version = await docDb.getVersion(versionId);
  if (!version || version.document_id !== docId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
  }

  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Bad JSON' } }, 400); }
  const parsed = CitationAuditResultSchema.safeParse((body as { result?: unknown })?.result);
  if (!parsed.success) return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid citation result' } }, 400);

  await docDb.storeCitationAuditOnVersion(versionId, JSON.stringify(parsed.data));
  return json({ ok: true });
};
