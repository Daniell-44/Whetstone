export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeApiKeyDb } from '../../../../functions/_lib/api-keys/db';
import { handleListKeys, handleCreateKey } from '../../../../functions/_lib/api-keys/handler';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

async function getAuthedUser(request: Request) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return null;
  return session.user_id;
}

function unauth() {
  return new Response(JSON.stringify({ ok: false, error: 'Unauthorised' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET({ request }: APIContext) {
  const userId = await getAuthedUser(request);
  if (!userId) return unauth();
  return handleListKeys(userId, makeApiKeyDb(env.DB));
}

export async function POST({ request }: APIContext) {
  const userId = await getAuthedUser(request);
  if (!userId) return unauth();
  return handleCreateKey(request, userId, makeApiKeyDb(env.DB));
}
