export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../functions/_lib/workspaces/permissions';
import { handleEvidenceRequest } from '../../../functions/_lib/evidence-weighted/handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { anonSessionGate } from '../../../functions/_lib/rate-limit';
import type { AnonGate } from '../../../functions/_lib/rate-limit';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);

  // Anonymous callers get three runs per browser session before sign-in is
  // required (free-tier decision, 2026-08-14). The gate lives here, not in the
  // handler, so the Set-Cookie for a newly minted anonymous id can ride
  // whichever response the handler returns.
  const session = await getSessionFromRequest(request, authDb);
  let gate: AnonGate | undefined;
  if (!session) {
    gate = await anonSessionGate(request, env.RATE_LIMIT);
    if (gate.block) return gate.block;
  }

  const res = await handleEvidenceRequest(request, {
    rateLimitKv:      env.RATE_LIMIT,
    geminiApiKey:     env.GEMINI_API_KEY,
    evidenceDailyCap: parseInt(env.EVIDENCE_DAILY_CAP ?? '10', 10),
    provider,
    // The session was already resolved for the gate above; reuse it rather
    // than hitting the sessions table a second time.
    getSession:       async () => session ? { userId: session.user_id } : null,
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
  });

  // A use is a run, not an attempt: count only when the handler really ran.
  if (gate && res.status < 400) await gate.commit();
  if (gate?.setCookie) res.headers.append('Set-Cookie', gate.setCookie);
  return res;
};
