export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { analyseTopic } from '../../../../functions/_lib/topic-analysis/engine';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';
const provider = new GeminiProvider();

const BodySchema = z.object({
  sources: z.array(z.object({
    id:     z.string().min(1),
    outlet: z.string().min(1),
    text:   z.string().min(50).max(12_000),
  })).min(2).max(5),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request }: APIContext) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ ok: false, error: 'Unauthorised' }, 401);
  const user = await authDb.findUserById(session.user_id);
  if (!user || user.email !== ADMIN_EMAIL) return json({ ok: false, error: 'Forbidden' }, 403);

  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);

  if (!env.GEMINI_API_KEY) return json({ ok: false, error: 'Service unavailable' }, 503);

  try {
    const { result } = await analyseTopic(parsed.data.sources, { provider, apiKey: env.GEMINI_API_KEY });
    return json({ ok: true, result });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Analysis failed' }, 500);
  }
}
