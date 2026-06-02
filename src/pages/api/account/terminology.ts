export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const BodySchema = z.object({
  preference: z.enum(['plain', 'formal']),
});

export const PATCH: APIRoute = async ({ request }) => {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED' } }, 401);

  let body: unknown;
  try { body = await request.json(); } catch {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'preference must be "plain" or "formal"' } }, 400);
  }

  await authDb.setTerminologyPreference(session.user_id, parsed.data.preference);
  return json({ ok: true, preference: parsed.data.preference });
};
