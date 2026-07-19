export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeEmailCaptureDb } from '../../../../functions/_lib/email-capture/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Admin-only export of the email capture list (newest first). Same gate as
// /api/admin/analytics: a signed-in session whose account email is the admin's.
export async function GET({ request }: APIContext) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ error: 'Unauthorised' }, 401);
  const user = await authDb.findUserById(session.user_id);
  if (!user || user.email !== ADMIN_EMAIL) return json({ error: 'Forbidden' }, 403);

  const db   = makeEmailCaptureDb(env.DB);
  const rows = await db.listAll();
  return json({ ok: true, count: rows.length, rows });
}
