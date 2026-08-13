export const prerender = false;

// One tap from /admin/briefings recording whether a run was any good.
//
// With one user and no corpus this is the only accuracy signal that will ever
// exist for the mini-briefing, so it gets a real endpoint rather than living in
// a notebook. Admin-gated exactly like the other admin routes.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { setVerdict, type MiniDb } from '../../../../functions/_lib/premise/store';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const authDb = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ ok: false, error: 'Forbidden' }, 403);
  const user = await authDb.findUserById(session.user_id);
  if (!user || user.email !== ADMIN_EMAIL) return json({ ok: false, error: 'Forbidden' }, 403);

  let body: { id?: unknown; verdict?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const verdict = typeof body.verdict === 'string' ? body.verdict : '';
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;

  const ok = await setVerdict(env.DB as unknown as MiniDb, id, verdict, note);
  return ok ? json({ ok: true }) : json({ ok: false, error: 'Could not record that' }, 400);
};
