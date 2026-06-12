export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { makeTopicTakesDb } from '../../../../functions/_lib/topic/takes-db';
import type { TakeStatus } from '../../../../functions/_lib/topic/takes-db';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// GET /api/curator/takes?status=pending  — admin moderation queue.
// Returns full take records (including user_id) since this is admin-only.
export async function GET({ request, url }: APIContext) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ ok: false, error: 'Unauthorised' }, 401);
  const user = await authDb.findUserById(session.user_id);
  if (!user || user.email !== ADMIN_EMAIL) return json({ ok: false, error: 'Forbidden' }, 403);

  const status = (url.searchParams.get('status') ?? 'pending') as TakeStatus;
  const takesDb = makeTopicTakesDb(env.DB);
  const takes = await takesDb.listByStatus(status);
  return json({ ok: true, takes });
}
