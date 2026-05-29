export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../../../functions/_lib/auth/db';
import { makeDocumentDb } from '../../../../../../../functions/_lib/documents/db';
import { handleRestoreVersion } from '../../../../../../../functions/_lib/documents/handlers';
import { getSessionFromRequest } from '../../../../../../../functions/_lib/auth/sessions';

function newId() { return crypto.randomUUID(); }

export const POST: APIRoute = async ({ request, params }) => {
  const authDb = makeAuthDb(env.DB);
  const docDb  = makeDocumentDb(env.DB);

  return handleRestoreVersion(request, params.id!, params.versionId!, {
    db:         docDb,
    getSession: (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    newId,
  });
};
