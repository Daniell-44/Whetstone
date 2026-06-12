export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../../functions/_lib/auth/sessions';
import { makeTopicTakesDb } from '../../../../../functions/_lib/topic/takes-db';
import type { TopicTake } from '../../../../../functions/_lib/topic/takes-db';
import { filterTakeBody, filterDisplayName } from '../../../../../functions/_lib/topic/take-filter';
import { getTopic } from '../../../../../functions/_lib/topic/storage';
import { generateId } from '../../../../../functions/_lib/auth/tokens';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Public-safe projection — never leak user_id to the client.
function publicTake(t: TopicTake) {
  return { id: t.id, displayName: t.display_name, body: t.body, kind: t.kind, createdAt: t.created_at };
}

// GET — approved takes for the topic (public).
export async function GET({ params }: APIContext) {
  const slug = params.slug!;
  const takesDb = makeTopicTakesDb(env.DB);
  const takes = await takesDb.listApproved(slug);
  return json({ ok: true, takes: takes.map(publicTake) });
}

const PostSchema = z.object({
  body:        z.string().min(1).max(280),
  displayName: z.string().min(1).max(60),
  kind:        z.enum(['community', 'editor']).optional(),  // editor only honoured for admin
});

// POST — submit a take (account required). Post-moderation: status='approved'
// immediately after the filter. One community take per user per topic (updates).
export async function POST({ request, params }: APIContext) {
  const slug = params.slug!;
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ ok: false, error: 'Sign in to post a take.' }, 401);

  // Topic must exist + be published (admins may post on drafts).
  const topic = await getTopic(env.SCORECARDS, slug);
  if (!topic) return json({ ok: false, error: 'Topic not found.' }, 404);

  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
  const parsed = PostSchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);

  const bodyCheck = filterTakeBody(parsed.data.body);
  if (!bodyCheck.ok) return json({ ok: false, error: bodyCheck.error }, 400);
  const nameCheck = filterDisplayName(parsed.data.displayName);
  if (!nameCheck.ok) return json({ ok: false, error: nameCheck.error }, 400);

  const user = await authDb.findUserById(session.user_id);
  const isAdmin = !!user && user.email === ADMIN_EMAIL;
  const kind = (parsed.data.kind === 'editor' && isAdmin) ? 'editor' : 'community';

  const takesDb = makeTopicTakesDb(env.DB);

  // One community take per user per topic — update body if they already have one.
  if (kind === 'community') {
    const existing = await takesDb.findUserTake(slug, session.user_id);
    if (existing) {
      await takesDb.updateBody(existing.id, parsed.data.body.trim());
      return json({ ok: true, updated: true });
    }
  }

  const take: TopicTake = {
    id:           generateId(),
    topic_slug:   slug,
    user_id:      session.user_id,
    display_name: parsed.data.displayName.trim(),
    body:         parsed.data.body.trim(),
    kind,
    status:       'approved',
    created_at:   Date.now(),
  };
  await takesDb.insert(take);
  return json({ ok: true, take: publicTake(take) });
}
