export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../functions/_lib/workspaces/permissions';
import { handleDisagreeRequest } from '../../../functions/_lib/disagreement-engagement/handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleDisagreeRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    disagreeDailyCap:  parseInt(env.DISAGREE_DAILY_CAP ?? '50', 10),
    provider,
    getSession:        (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
  });
};
