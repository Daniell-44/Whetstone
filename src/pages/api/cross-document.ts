export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { fetchAndExtractWithFallback } from '../../../functions/_lib/extract/scraper-fallback';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../functions/_lib/workspaces/permissions';
import { handleCrossDocumentRequest } from '../../../functions/_lib/cross-document/handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);

  return handleCrossDocumentRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    crossDocDailyCap:  parseInt(env.CROSSDOC_DAILY_CAP ?? '5', 10),
    provider,
    extractor:         (url) => fetchAndExtractWithFallback(url, { scrapingBeeApiKey: env.SCRAPINGBEE_API_KEY }),
    getSession:        (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
  });
};
