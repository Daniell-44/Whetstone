export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { handleToneRequest } from '../../../functions/_lib/tone-posture/handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb = makeAuthDb(env.DB);

  return handleToneRequest(request, {
    rateLimitKv:   env.RATE_LIMIT,
    geminiApiKey:  env.GEMINI_API_KEY,
    toneDailyCap:  parseInt(env.TONE_DAILY_CAP ?? '50', 10),
    provider,
    getSession:    (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
  });
};
