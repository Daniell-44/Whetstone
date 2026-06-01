export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../../functions/_lib/auth/db';
import { makeFindingActionDb } from '../../../../../../functions/_lib/documents/finding-actions';
import { handleDeleteFindingAction } from '../../../../../../functions/_lib/documents/finding-actions-handler';
import { getSessionFromRequest } from '../../../../../../functions/_lib/auth/sessions';

// DELETE /api/documents/[id]/finding-actions/[actionId]
export const DELETE: APIRoute = async ({ request, params }) => {
  const authDb   = makeAuthDb(env.DB);
  const actionDb = makeFindingActionDb(env.DB);

  return handleDeleteFindingAction(request, {
    db:         actionDb,
    actionId:   params.actionId!,
    getSession: (req: Request) =>
      getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
  });
};
