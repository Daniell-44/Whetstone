export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../../../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../../../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../../../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../../../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../../../../../functions/_lib/workspaces/permissions';
import { makeDocumentDb } from '../../../../../../../functions/_lib/documents/db';
import { handleVersionCommitments } from '../../../../../../../functions/_lib/documents/handlers';
import { getSessionFromRequest } from '../../../../../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  const docDb       = makeDocumentDb(env.DB);

  return handleVersionCommitments(request, params.id!, params.versionId!, {
    db:                docDb,
    provider,
    geminiApiKey:      env.GEMINI_API_KEY,
    getSession:        (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
  });
};
