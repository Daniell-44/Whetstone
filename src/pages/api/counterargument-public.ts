export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { handlePublicCounterargRequest } from '../../../functions/_lib/counterargument/public-handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb = makeAuthDb(env.DB);
  return handlePublicCounterargRequest(request, {
    rateLimitKv:                env.RATE_LIMIT,
    geminiApiKey:               env.GEMINI_API_KEY,
    publicCounterargDailyCap:   parseInt(env.PUBLIC_COUNTERARG_DAILY_CAP   ?? '5',  10),
    loggedInCounterargDailyCap: parseInt(env.LOGGEDIN_COUNTERARG_DAILY_CAP ?? '20', 10),
    provider,
    getSession: (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
  });
};
