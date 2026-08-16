export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { handleMiniRequest } from '../../../../functions/_lib/premise/handler';
import type { MiniDb } from '../../../../functions/_lib/premise/store';
import { anonSessionGate, type AnonGate } from '../../../../functions/_lib/rate-limit';

// The mini-briefing on command. Two depths, deliberately: 'outline' is the
// ~5 second answer the reader starts on, 'full' is the ~35 second sourced one.
// See functions/_lib/premise/handler.ts for why this is two requests and not
// a stream.
const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request, locals }) => {
  const db = makeAuthDb(env.DB);

  // The three-runs-per-session gate (free-tier decision, 2026-08-14) applies
  // to QUESTION runs only, which come from the site's own pages. The extension
  // paths keep their existing daily IP metering: putting them behind the
  // session gate would change shipped extension behaviour as a rider on a site
  // page, and that belongs to a deliberate extension release.
  //
  // The body is peeked from a clone because the handler reads the request
  // stream itself. A use is committed only on a successful FULL run: the
  // outline is a tenth of a cent, and one question costs one run, not two.
  let peek: { trigger?: unknown; depth?: unknown } = {};
  try { peek = await request.clone().json() as typeof peek; } catch { /* handler returns the 400 */ }

  let gate: AnonGate | undefined;
  if (peek.trigger === 'question') {
    const session = await getSessionFromRequest(request, db);
    if (!session) {
      gate = await anonSessionGate(request, env.RATE_LIMIT);
      if (gate.block) return gate.block;
    }
  }

  const res = await handleMiniRequest(request, {
    provider,
    geminiApiKey: env.GEMINI_API_KEY,
    rateLimitKv: env.RATE_LIMIT,
    db: env.DB as unknown as MiniDb,
    dailyCap: parseInt(env.AUDIT_DAILY_CAP ?? '10', 10),
    userDailyCap: parseInt(env.AUDIT_USER_DAILY_CAP ?? '50', 10),
    getSession: (req) => getSessionFromRequest(req, db).then((s) => (s ? { userId: s.user_id } : null)),
    waitUntil: deferrer(locals),
  });

  // A use is a run, not an attempt, and for questions only the full run
  // counts. The Set-Cookie for a newly minted anonymous id rides whichever
  // response goes out, including the errors, so the session is stable from the
  // visitor's first click.
  if (gate && peek.depth === 'full' && res.status < 400) await gate.commit();
  if (gate?.setCookie) res.headers.append('Set-Cookie', gate.setCookie);
  return res;
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
