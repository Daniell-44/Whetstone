export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { makeDocumentDb } from '../../../functions/_lib/documents/db';
import { makeFeedbackDb } from '../../../functions/_lib/feedback/db';
import { handleSubmitFeedback } from '../../../functions/_lib/feedback/handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

function newId() { return crypto.randomUUID(); }

export const POST: APIRoute = async ({ request }) => {
  const authDb     = makeAuthDb(env.DB);
  const docDb      = makeDocumentDb(env.DB);
  const feedbackDb = makeFeedbackDb(env.DB);

  return handleSubmitFeedback(request, {
    db:               feedbackDb,
    rateLimitKv:      env.RATE_LIMIT,
    feedbackDailyCap: 60,
    newId,
    getSession:       (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    getDocumentOwnerId: async (docId) => {
      const doc = await docDb.getDocumentById(docId);
      return doc ? doc.user_id : null;
    },
  });
};
