export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { fetchAndExtractWithFallback } from '../../../functions/_lib/extract/scraper-fallback';
import { handleAuditRequest } from '../../../functions/_lib/audit/handler';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { makeApiKeyDb } from '../../../functions/_lib/api-keys/db';
import { resolveApiKeyIdentity } from '../../../functions/_lib/api-keys/resolve';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const db          = makeAuthDb(env.DB);
  const apiKeyDb    = makeApiKeyDb(env.DB);

  return handleAuditRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    freeUseAllowance:  parseInt(env.AUDIT_FREE_USES ?? '3', 10),
    provider,
    extractor: (url) => fetchAndExtractWithFallback(url, { scrapingBeeApiKey: env.SCRAPINGBEE_API_KEY }),
    getSession: async (req) => {
      const session = await getSessionFromRequest(req, db);
      if (session) return { userId: session.user_id };
      const userId = await resolveApiKeyIdentity(req, apiKeyDb);
      if (userId) return { userId };
      return null;
    },
  });
};
