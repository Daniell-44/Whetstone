export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../../../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../../../../../functions/_lib/auth/db';
import { makeDocumentDb } from '../../../../../../../functions/_lib/documents/db';
import { handleVersionAudit } from '../../../../../../../functions/_lib/documents/handlers';
import { getSessionFromRequest } from '../../../../../../../functions/_lib/auth/sessions';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request, params }) => {
  const authDb = makeAuthDb(env.DB);
  const docDb  = makeDocumentDb(env.DB);

  return handleVersionAudit(request, params.id!, params.versionId!, {
    db:           docDb,
    provider,
    geminiApiKey: env.GEMINI_API_KEY,
    // Same allowance as /api/audit — a saved-draft audit is still an audit.
    rateLimitKv:      env.RATE_LIMIT,
    freeUseAllowance: parseInt(env.AUDIT_FREE_USES ?? '3', 10),
    getSession:   (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
  });
};
