export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { makeWorkspaceDb } from '../../../../functions/_lib/workspaces/db';
import { handleListWorkspaces, handleCreateWorkspace } from '../../../../functions/_lib/workspaces/handlers';

function newId() { return crypto.randomUUID(); }

export const GET: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleListWorkspaces(request, {
    db:         workspaceDb,
    getSession: (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    newId,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleCreateWorkspace(request, {
    db:         workspaceDb,
    getSession: (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    newId,
  });
};
