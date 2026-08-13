export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { handleMiniRequest } from '../../../../functions/_lib/premise/handler';
import type { MiniDb } from '../../../../functions/_lib/premise/store';

// The mini-briefing on command. Two depths, deliberately: 'outline' is the
// ~5 second answer the reader starts on, 'full' is the ~35 second sourced one.
// See functions/_lib/premise/handler.ts for why this is two requests and not
// a stream.
const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request, locals }) => {
  const db = makeAuthDb(env.DB);
  return handleMiniRequest(request, {
    provider,
    geminiApiKey: env.GEMINI_API_KEY,
    rateLimitKv: env.RATE_LIMIT,
    db: env.DB as unknown as MiniDb,
    dailyCap: parseInt(env.AUDIT_DAILY_CAP ?? '10', 10),
    userDailyCap: parseInt(env.AUDIT_USER_DAILY_CAP ?? '50', 10),
    getSession: (req) => getSessionFromRequest(req, db).then((s) => (s ? { userId: s.user_id } : null)),
    waitUntil: (p) => (locals as { runtime?: { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } })
      .runtime?.ctx?.waitUntil?.(p),
  });
};
