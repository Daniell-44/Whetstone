export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../../functions/_lib/auth/sessions';
import { makeTopicTakesDb } from '../../../../../functions/_lib/topic/takes-db';
import { checkAndIncrementQuota } from '../../../../../functions/_lib/rate-limit';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const BodySchema = z.object({
  action: z.enum(['report', 'approve', 'reject', 'delete']),
});

// POST /api/topic/takes/[id]  { action }
//   report  — any signed-in user; sets status='pending' (hidden, queued for review)
//   approve/reject/delete — admin only
export async function POST({ request, params }: APIContext) {
  const id = params.id!;
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ ok: false, error: 'Sign in required.' }, 401);

  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: 'Invalid action' }, 400);

  const takesDb = makeTopicTakesDb(env.DB);
  const user = await authDb.findUserById(session.user_id);
  const isAdmin = !!user && user.email === ADMIN_EMAIL;

  if (parsed.data.action === 'report') {
    // Rate-limit reports per user so reporting can't be used to mass-hide.
    if (env.RATE_LIMIT) {
      const q = await checkAndIncrementQuota(env.RATE_LIMIT, `take-report:${session.user_id}`, 20);
      if (!q.allowed) return json({ ok: false, error: 'Too many reports today.' });
    }
    await takesDb.setStatus(id, 'pending'); // hidden pending admin review
    return json({ ok: true });
  }

  // Moderation actions — admin only.
  if (!isAdmin) return json({ ok: false, error: 'Forbidden' }, 403);
  if (parsed.data.action === 'approve') await takesDb.setStatus(id, 'approved');
  if (parsed.data.action === 'reject')  await takesDb.setStatus(id, 'rejected');
  if (parsed.data.action === 'delete')  await takesDb.delete(id);
  return json({ ok: true });
}
