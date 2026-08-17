export const prerender = false;

/**
 * Publish or unpublish one reader question, from /admin/briefings.
 *
 * Publication is an owner action, so it needs a real endpoint rather than a
 * flag someone flips in the database by hand. Admin-gated exactly like the
 * other admin routes.
 *
 * The eligibility floor is NOT checked here: it lives in publishMiniBriefing,
 * against the stored payload, so an admin page working from a stale list can
 * never talk this endpoint into publishing a run that has no verified quote.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { publishMiniBriefing, unpublishMiniBriefing } from '../../../../functions/_lib/premise/publish';
import type { MiniDb } from '../../../../functions/_lib/premise/store';

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

  let body: { id?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const id = typeof body.id === 'string' ? body.id : '';
  const db = env.DB as unknown as MiniDb;

  if (body.action === 'unpublish') {
    const ok = await unpublishMiniBriefing(db, id);
    return ok ? json({ ok: true, published: false }) : json({ ok: false, error: 'Could not unpublish' }, 400);
  }

  const res = await publishMiniBriefing(db, id);
  return res.ok
    ? json({ ok: true, published: true, slug: res.slug })
    : json({ ok: false, error: res.reason ?? 'Could not publish' }, 400);
};
