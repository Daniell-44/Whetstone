export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { handleLogout } from '../../../../functions/_lib/auth/handlers';

export const GET: APIRoute  = async ({ request }) => handleLogout(request, { db: makeAuthDb(env.DB) });
export const POST: APIRoute = async ({ request }) => handleLogout(request, { db: makeAuthDb(env.DB) });
