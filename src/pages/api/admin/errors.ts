export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeErrorDb } from '../../../../functions/_lib/errors/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

// Hardcoded admin email — only this user can view errors.
const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET({ request, url }: APIContext) {
  // Auth check — must be the admin
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ error: 'Unauthorised' }, 401);

  const user = await authDb.findUserById(session.user_id);
  if (!user || user.email !== ADMIN_EMAIL) return json({ error: 'Forbidden' }, 403);

  const errorDb = makeErrorDb(env.DB);
  const limit   = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const action  = url.searchParams.get('action');

  // Purge old errors (older than 30 days)
  if (action === 'purge') {
    const cutoff  = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const deleted = await errorDb.purgeOlderThan(cutoff);
    return json({ ok: true, deleted });
  }

  // Summary: error counts by path in the last 24h
  if (action === 'summary') {
    const since   = Date.now() - 24 * 60 * 60 * 1000;
    const summary = await errorDb.countByPath(since);
    return json({ ok: true, since: new Date(since).toISOString(), summary });
  }

  // Default: list recent errors
  const errors = await errorDb.listRecent(Math.min(limit, 200));
  return json({ ok: true, count: errors.length, errors });
}
