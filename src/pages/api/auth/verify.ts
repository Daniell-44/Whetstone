export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { handleVerify } from '../../../../functions/_lib/auth/handlers';

export const GET: APIRoute = async ({ request }) => {
  return handleVerify(request, { db: makeAuthDb(env.DB) });
};
