export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeFeedbackDb } from '../../../../functions/_lib/feedback/db';
import { handleAdminFeedback } from '../../../../functions/_lib/feedback/handler';

export const GET: APIRoute = async ({ request }) => {
  const feedbackDb = makeFeedbackDb(env.DB);
  return handleAdminFeedback(request, {
    db:          feedbackDb,
    adminSecret: env.ANALYSER_SECRET,
  });
};
