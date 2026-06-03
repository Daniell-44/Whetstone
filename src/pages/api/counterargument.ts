export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { handleCounterargRequest } from '../../../functions/_lib/counterargument/handler';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../functions/_lib/billing/subscription';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { makeWorkspaceDb } from '../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../functions/_lib/workspaces/permissions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);

  return handleCounterargRequest(request, {
    rateLimitKv:        env.RATE_LIMIT,
    geminiApiKey:       env.GEMINI_API_KEY,
    counterargDailyCap: parseInt(env.COUNTERARG_DAILY_CAP ?? '20', 10),
    provider,
    getSession:         (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    checkSubscription:  (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
  });
};
