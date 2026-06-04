export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { fetchAndExtract } from '../../../functions/_lib/extract/article';
import { handleAuditRequest } from '../../../functions/_lib/audit/handler';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { makeApiKeyDb } from '../../../functions/_lib/api-keys/db';
import { resolveApiKeyIdentity } from '../../../functions/_lib/api-keys/resolve';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const db       = makeAuthDb(env.DB);
  const apiKeyDb = makeApiKeyDb(env.DB);

  return handleAuditRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    auditDailyCap:     parseInt(env.AUDIT_DAILY_CAP     ?? '10', 10),
    auditUserDailyCap: parseInt(env.AUDIT_USER_DAILY_CAP ?? '50', 10),
    provider,
    extractor: fetchAndExtract,
    getSession: async (req) => {
      // Try cookie session first.
      const session = await getSessionFromRequest(req, db);
      if (session) return { userId: session.user_id };
      // Fall back to API key auth.
      const userId = await resolveApiKeyIdentity(req, apiKeyDb);
      if (userId) return { userId };
      return null;
    },
  });
};
