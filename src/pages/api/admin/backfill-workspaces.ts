export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeWorkspaceDb } from '../../../../functions/_lib/workspaces/db';
import { handleBackfillWorkspaces } from '../../../../functions/_lib/workspaces/handlers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';

function newId() { return crypto.randomUUID(); }

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleBackfillWorkspaces(request, {
    db:     workspaceDb,
    newId,
    secret: env.ANALYSER_SECRET,
    getUserEmail: async (userId) => {
      const user = await authDb.findUserById(userId);
      return user?.email ?? null;
    },
  });
};
