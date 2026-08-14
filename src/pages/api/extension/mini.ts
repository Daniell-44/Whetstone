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
    waitUntil: deferrer(locals),
  });
};

/**
 * Finish the database write after the response has gone out, if the platform
 * offers a way to. Returns undefined when it does not, and the handler then
 * simply waits for the write instead.
 *
 * WHY THIS IS WRAPPED. The first version read `locals.runtime.ctx`, which
 * Astro 6 removed. It does not merely return undefined: the getter THROWS,
 * so optional chaining did not save it, and the exception escaped into the
 * handler's catch and turned every full briefing into a 502. Nineteen seconds
 * of real work and two paid searches, thrown away because of the bookkeeping.
 *
 * A convenience that can take down the product is not a convenience. Anything
 * that goes wrong in here now costs the deferral and nothing else.
 */
function deferrer(locals: unknown): ((p: Promise<unknown>) => void) | undefined {
  try {
    const ctx = (locals as { cfContext?: { waitUntil?: (p: Promise<unknown>) => void } }).cfContext;
    if (typeof ctx?.waitUntil === 'function') return (p) => ctx.waitUntil!(p);
  } catch {
    // Adapter changed shape again. Fall through and wait for the write.
  }
  return undefined;
}
