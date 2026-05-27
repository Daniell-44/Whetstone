export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeEmailSender } from '../../../../functions/_lib/auth/email';
import { handleRequestLink } from '../../../../functions/_lib/auth/handlers';

export const POST: APIRoute = async ({ request }) => {
  return handleRequestLink(request, {
    db:          makeAuthDb(env.DB),
    rateLimitKv: env.RATE_LIMIT,
    sendEmail:   makeEmailSender(env.RESEND_API_KEY ?? ''),
    siteUrl:     env.SITE_URL ?? 'https://whetstone.so',
  });
};
