export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { makeAnalyticsDb } from '../../../../functions/_lib/analytics/db';
import { ANALYTICS_EVENT_NAMES } from '../../../../functions/_lib/analytics/events';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

const BodySchema = z.object({
  events: z.array(z.object({
    eventName:   z.enum(ANALYTICS_EVENT_NAMES),
    sessionHash: z.string().min(8).max(64),
    path:        z.string().max(200).optional(),
    metadata:    z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })).min(1).max(50),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST({ request }: APIContext) {
  // Drop silently if D1 isn't bound (e.g. dev without DB)
  if (!env.DB) return json({ ok: true, accepted: 0 });

  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false }, 400); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return json({ ok: false }, 400);

  // Resolve user id from cookie if present - analytics for signed-in users is
  // joined to their account; anonymous events stay session-hash-only.
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  const userId  = session?.user_id ?? null;

  const db = makeAnalyticsDb(env.DB);
  let accepted = 0;
  for (const e of parsed.data.events) {
    try {
      await db.insert({
        eventName:   e.eventName,
        sessionHash: e.sessionHash,
        userId,
        path:        e.path ?? null,
        metadata:    e.metadata,
      });
      accepted++;
    } catch {
      // Never let an analytics write crash the response
    }
  }

  return json({ ok: true, accepted });
}
