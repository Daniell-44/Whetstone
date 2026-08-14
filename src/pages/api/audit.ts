export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { fetchAndExtractWithFallback } from '../../../functions/_lib/extract/scraper-fallback';
import { handleAuditRequest } from '../../../functions/_lib/audit/handler';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../functions/_lib/workspaces/permissions';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { makeApiKeyDb } from '../../../functions/_lib/api-keys/db';
import { resolveApiKeyIdentity } from '../../../functions/_lib/api-keys/resolve';
import { anonSessionGate } from '../../../functions/_lib/rate-limit';
import type { AnonGate } from '../../../functions/_lib/rate-limit';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const db          = makeAuthDb(env.DB);
  const apiKeyDb    = makeApiKeyDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);

  // Identity can come from a session cookie or an API key; either one counts
  // as signed in for the anonymous session gate below.
  const identity = await (async () => {
    const session = await getSessionFromRequest(request, db);
    if (session) return { userId: session.user_id };
    const userId = await resolveApiKeyIdentity(request, apiKeyDb);
    if (userId) return { userId };
    return null;
  })();

  // On top of the existing per-IP daily cap, anonymous callers get three runs
  // per browser session before sign-in is required (free-tier decision,
  // 2026-08-14). The gate lives here, not in the handler, so the Set-Cookie
  // for a newly minted anonymous id can ride whichever response goes out.
  let gate: AnonGate | undefined;
  if (!identity) {
    gate = await anonSessionGate(request, env.RATE_LIMIT);
    if (gate.block) return gate.block;
  }

  const res = await handleAuditRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    auditDailyCap:     parseInt(env.AUDIT_DAILY_CAP     ?? '10', 10),
    auditUserDailyCap: parseInt(env.AUDIT_USER_DAILY_CAP ?? '50', 10),
    provider,
    extractor: (url) => fetchAndExtractWithFallback(url, { scrapingBeeApiKey: env.SCRAPINGBEE_API_KEY }),
    // The identity was already resolved for the gate above; reuse it rather
    // than hitting the database a second time.
    getSession: async () => identity,
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
  });

  // A use is a run, not an attempt: count only when the handler really ran.
  if (gate && res.status < 400) await gate.commit();
  if (gate?.setCookie) res.headers.append('Set-Cookie', gate.setCookie);
  return res;
};
