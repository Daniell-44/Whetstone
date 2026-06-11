export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { findExperiment } from '../../../../functions/_lib/ab/experiments';
import { assignVariant }  from '../../../../functions/_lib/ab/assign';
import { makeAuthDb }     from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

const BodySchema = z.object({
  experiment:  z.string().min(1).max(80),
  sessionHash: z.string().min(8).max(64),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST({ request }: APIContext) {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false }, 400); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: 'bad_request' }, 400);

  const exp = findExperiment(parsed.data.experiment);
  if (!exp) return json({ ok: false, error: 'unknown_experiment' }, 404);

  // Prefer userId for stable cross-device assignment if signed in
  let subjectId = parsed.data.sessionHash;
  if (env.DB) {
    const authDb  = makeAuthDb(env.DB);
    const session = await getSessionFromRequest(request, authDb);
    if (session?.user_id) subjectId = `u:${session.user_id}`;
  }

  const variant = assignVariant(exp, subjectId);
  return json({ ok: true, experiment: exp.key, variant, status: exp.status });
}
