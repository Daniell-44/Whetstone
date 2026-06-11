export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeAnalyticsDb } from '../../../../functions/_lib/analytics/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET({ request, url }: APIContext) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ error: 'Unauthorised' }, 401);
  const user = await authDb.findUserById(session.user_id);
  if (!user || user.email !== ADMIN_EMAIL) return json({ error: 'Forbidden' }, 403);

  const db     = makeAnalyticsDb(env.DB);
  const action = url.searchParams.get('action');

  if (action === 'purge') {
    const cutoff  = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const deleted = await db.purgeOlderThan(cutoff);
    return json({ ok: true, deleted });
  }

  // Default: 24-hour summary
  const since   = Date.now() - 24 * 60 * 60 * 1000;
  const summary = await db.countByEvent(since);
  const total   = await db.count(since);
  return json({
    ok:    true,
    since: new Date(since).toISOString(),
    total,
    by_event: summary,
  });
}
