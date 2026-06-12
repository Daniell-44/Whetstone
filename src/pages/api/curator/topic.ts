export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { saveTopic, listTopics, deleteTopic } from '../../../../functions/_lib/topic/storage';
import { StoredTopicSchema } from '../../../../functions/_lib/topic/schemas';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function requireAdmin(request: Request): Promise<boolean> {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return false;
  const user = await authDb.findUserById(session.user_id);
  return !!user && user.email === ADMIN_EMAIL;
}

// GET — list all topics (drafts included) for the curator.
export async function GET({ request }: APIContext) {
  if (!await requireAdmin(request)) return json({ ok: false, error: 'Forbidden' }, 403);
  const topics = await listTopics(env.SCORECARDS);
  return json({ ok: true, topics });
}

// POST — save (create or update) a topic.
export async function POST({ request }: APIContext) {
  if (!await requireAdmin(request)) return json({ ok: false, error: 'Forbidden' }, 403);
  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
  const parsed = StoredTopicSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid topic' }, 400);
  const slug = await saveTopic(env.SCORECARDS, parsed.data);
  return json({ ok: true, slug });
}

// DELETE — remove a topic by ?slug=.
export async function DELETE({ request, url }: APIContext) {
  if (!await requireAdmin(request)) return json({ ok: false, error: 'Forbidden' }, 403);
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ ok: false, error: 'Missing slug' }, 400);
  await deleteTopic(env.SCORECARDS, slug);
  return json({ ok: true });
}
