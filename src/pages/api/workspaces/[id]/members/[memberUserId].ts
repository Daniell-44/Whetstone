export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../../../functions/_lib/auth/sessions';
import { makeWorkspaceDb } from '../../../../../../functions/_lib/workspaces/db';
import { handleUpdateMember, handleRemoveMember } from '../../../../../../functions/_lib/workspaces/handlers';

function newId() { return crypto.randomUUID(); }

function deps(authDb: ReturnType<typeof makeAuthDb>, workspaceDb: ReturnType<typeof makeWorkspaceDb>) {
  return {
    db:         workspaceDb,
    getSession: (req: Request) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    newId,
  };
}

export const PATCH: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleUpdateMember(request, params.id!, params.memberUserId!, deps(authDb, workspaceDb));
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleRemoveMember(request, params.id!, params.memberUserId!, deps(authDb, workspaceDb));
};
