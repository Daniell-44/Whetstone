export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { handleCounterargRequest } from '../../../functions/_lib/counterargument/handler';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const db = makeAuthDb(env.DB);
  return handleCounterargRequest(request, {
    rateLimitKv:        env.RATE_LIMIT,
    geminiApiKey:       env.GEMINI_API_KEY,
    counterargDailyCap: parseInt(env.COUNTERARG_DAILY_CAP ?? '20', 10),
    provider,
    getSession: (req) => getSessionFromRequest(req, db).then(s => s ? { userId: s.user_id } : null),
  });
};
