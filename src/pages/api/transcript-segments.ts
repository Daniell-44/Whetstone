export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { handleSegmentRequest } from '../../../functions/_lib/transcript/segment-handler';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const db = makeAuthDb(env.DB);
  return handleSegmentRequest(request, {
    rateLimitKv:  env.RATE_LIMIT,
    geminiApiKey: env.GEMINI_API_KEY,
    userDailyCap: parseInt(env.TRANSCRIPT_SEGMENT_USER_CAP ?? '20', 10),
    anonDailyCap: parseInt(env.TRANSCRIPT_SEGMENT_ANON_CAP ?? '5',  10),
    provider,
    getSession: (req) => getSessionFromRequest(req, db).then((s) => (s ? { userId: s.user_id } : null)),
  });
};
