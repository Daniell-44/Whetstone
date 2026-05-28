export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeDocumentDb } from '../../../../functions/_lib/documents/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function getOwned(request: Request, docId: string) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return { error: json({ ok: false, error: { code: 'UNAUTHORIZED' } }, 401) };

  const docDb = makeDocumentDb(env.DB);
  const doc   = await docDb.getDocumentById(docId);
  if (!doc || doc.user_id !== session.user_id) {
    return { error: json({ ok: false, error: { code: 'NOT_FOUND' } }, 404) };
  }
  return { session, doc, docDb };
}

// GET /api/documents/[id]
export const GET: APIRoute = async ({ request, params }) => {
  const { error, doc, docDb } = await getOwned(request, params.id!);
  if (error) return error;

  const latestVersion = await docDb!.getLatestVersion(doc!.id);
  return json({ ok: true, document: doc, latestVersion });
};

// PATCH /api/documents/[id]  — update title
export const PATCH: APIRoute = async ({ request, params }) => {
  const { error, doc, docDb } = await getOwned(request, params.id!);
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const { title } = body as { title?: string };
  if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Title must be 1–200 characters' } }, 400);
  }

  await docDb!.updateDocumentTitle(doc!.id, title.trim());
  return json({ ok: true });
};

// DELETE /api/documents/[id]  — archive
export const DELETE: APIRoute = async ({ request, params }) => {
  const { error, doc, docDb } = await getOwned(request, params.id!);
  if (error) return error;

  await docDb!.archiveDocument(doc!.id);
  return json({ ok: true });
};
