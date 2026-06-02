export const prerender = false;

import type { APIRoute }         from 'astro';
import { env }                   from 'cloudflare:workers';
import { GeminiProvider }        from '../../../functions/_lib/providers/gemini';
import { fetchAndExtract }        from '../../../functions/_lib/extract/article';
import { handleCitationAuditRequest } from '../../../functions/_lib/citation-audit/handler';
import { makeAuthDb }             from '../../../functions/_lib/auth/db';
import { makeBillingDb, userHasActiveSubscription } from '../../../functions/_lib/billing/subscription';
import { getSessionFromRequest }  from '../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb    = makeAuthDb(env.DB);
  const billingDb = makeBillingDb(env.DB);

  return handleCitationAuditRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    citationDailyCap:  parseInt(env.CITATION_DAILY_CAP ?? '10', 10),
    provider,
    extractor:         fetchAndExtract,
    getSession:        (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    checkSubscription: (userId) => userHasActiveSubscription(billingDb, userId),
  });
};
