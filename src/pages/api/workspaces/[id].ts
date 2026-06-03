export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { makeWorkspaceDb } from '../../../../functions/_lib/workspaces/db';
import { handleGetWorkspace, handleUpdateWorkspace, handleDeleteWorkspace } from '../../../../functions/_lib/workspaces/handlers';

function newId() { return crypto.randomUUID(); }

function deps(workspaceId: string, authDb: ReturnType<typeof makeAuthDb>, workspaceDb: ReturnType<typeof makeWorkspaceDb>) {
  return {
    db:         workspaceDb,
    getSession: (req: Request) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    newId,
  };
}

export const GET: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleGetWorkspace(request, params.id!, deps(params.id!, authDb, workspaceDb));
};

export const PATCH: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleUpdateWorkspace(request, params.id!, deps(params.id!, authDb, workspaceDb));
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleDeleteWorkspace(request, params.id!, deps(params.id!, authDb, workspaceDb));
};
