export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { handleSiteFeedback } from '../../../functions/_lib/site-feedback/handler';

export const POST: APIRoute = async ({ request }) => {
  // Best-effort: attach the user id when the visitor happens to be signed in.
  const session = await getSessionFromRequest(request, makeAuthDb(env.DB)).catch(() => null);
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';

  return handleSiteFeedback(request, {
    insert: async (row) => {
      await env.DB
        .prepare('INSERT INTO site_feedback (id, message, email, source_path, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(row.id, row.message, row.email, row.source_path, row.user_id, row.created_at)
        .run();
    },
    rateLimitKv: env.RATE_LIMIT,
    dailyCap:    20,
    rateKey:     `site-feedback:ip:${ip}`,
    newId:       () => crypto.randomUUID(),
    userId:      session?.user_id ?? null,
  });
};
