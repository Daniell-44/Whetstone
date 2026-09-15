export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { handlePresupRequest } from '../../../functions/_lib/presupposition/handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);

  return handlePresupRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    presupDailyCap:    parseInt(env.PRESUP_DAILY_CAP ?? '50', 10),
    provider,
    getSession:        (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
  });
};
