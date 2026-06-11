export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { handleVerifyCode } from '../../../../functions/_lib/auth/handlers';

export const POST: APIRoute = async ({ request }) => {
  return handleVerifyCode(request, {
    db:          makeAuthDb(env.DB),
    rateLimitKv: env.RATE_LIMIT,
  });
};
