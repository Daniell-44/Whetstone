export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeApiKeyDb } from '../../../../functions/_lib/api-keys/db';
import { handleRevokeKey } from '../../../../functions/_lib/api-keys/handler';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';

export async function DELETE({ request, params }: APIContext) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorised' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return handleRevokeKey(params.keyId!, session.user_id, makeApiKeyDb(env.DB));
}
