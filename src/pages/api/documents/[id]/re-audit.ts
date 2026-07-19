export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../../../functions/_lib/billing/subscription';
import { makeDocumentDb } from '../../../../../functions/_lib/documents/db';
import { makeWorkspaceDb } from '../../../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../../../functions/_lib/workspaces/permissions';
import { handleReAudit } from '../../../../../functions/_lib/documents/re-audit';
import { getSessionFromRequest } from '../../../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

// POST /api/documents/[id]/re-audit — re-run the audit on the latest version,
// store it as a new version, return the finding delta vs the previous audit.
// Consumes one audit from the same quota bucket as /api/audit.
export const POST: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  const docDb       = makeDocumentDb(env.DB);

  return handleReAudit(request, params.id!, {
    db:                docDb,
    provider,
    geminiApiKey:      env.GEMINI_API_KEY,
    rateLimitKv:       env.RATE_LIMIT,
    getSession:        (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
    newId:             () => crypto.randomUUID(),
  });
};
