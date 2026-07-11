export const prerender = false;

import type { APIRoute }         from 'astro';
import { env, waitUntil }        from 'cloudflare:workers';
import { GeminiProvider }        from '../../../functions/_lib/providers/gemini';
import { fetchAndExtract }        from '../../../functions/_lib/extract/article';
import { handleCitationAuditRequest } from '../../../functions/_lib/citation-audit/handler';
import { makeAuthDb }             from '../../../functions/_lib/auth/db';
import { makeBillingDb }         from '../../../functions/_lib/billing/subscription';
import { makeDocumentDb }        from '../../../functions/_lib/documents/db';
import { getSessionFromRequest }  from '../../../functions/_lib/auth/sessions';
import { makeWorkspaceDb }       from '../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../functions/_lib/workspaces/permissions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  const docDb       = makeDocumentDb(env.DB);

  return handleCitationAuditRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    citationDailyCap:  parseInt(env.CITATION_DAILY_CAP ?? '10', 10),
    provider,
    extractor:         fetchAndExtract,
    getSession:        (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
    // Server-side persistence (ownership-checked): a phone locking mid-run can
    // no longer lose Source Match — the result lands on the version here, and
    // the reopened draft rehydrates it.
    persistResult: async (userId, documentId, versionId, resultJson) => {
      const doc = await docDb.getDocumentById(documentId);
      if (!doc || doc.user_id !== userId) return false;
      const version = await docDb.getVersion(versionId);
      if (!version || version.document_id !== documentId) return false;
      await docDb.storeCitationAuditOnVersion(versionId, resultJson);
      return true;
    },
    // Keeps run+persist alive if the client disconnects mid-request.
    waitUntil: (p) => waitUntil(p),
  });
};
