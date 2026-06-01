export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { handleExtractionRequest } from '../../../functions/_lib/argument-extraction/handler';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const db = makeAuthDb(env.DB);
  return handleExtractionRequest(request, {
    rateLimitKv:          env.RATE_LIMIT,
    geminiApiKey:         env.GEMINI_API_KEY,
    extractionDailyCap:     parseInt(env.AUDIT_DAILY_CAP     ?? '10', 10),
    extractionUserDailyCap: parseInt(env.AUDIT_USER_DAILY_CAP ?? '50', 10),
    provider,
    getSession: (req) => getSessionFromRequest(req, db).then(s => s ? { userId: s.user_id } : null),
  });
};
