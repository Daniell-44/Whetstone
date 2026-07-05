export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../../functions/_lib/auth/sessions';
import { makeWorkspaceDb } from '../../../../../functions/_lib/workspaces/db';
import { handleListInvitations, handleCreateInvitation } from '../../../../../functions/_lib/workspaces/handlers';
import { makeWorkspaceInvitationSender } from '../../../../../functions/_lib/auth/email';

function newId() { return crypto.randomUUID(); }

export const GET: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleListInvitations(request, params.id!, {
    db:         workspaceDb,
    getSession: (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    newId,
  });
};

export const POST: APIRoute = async ({ request, params }) => {
  const authDb      = makeAuthDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);
  return handleCreateInvitation(request, params.id!, {
    db:             workspaceDb,
    getSession:     (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    newId,
    sendInvitation: env.RESEND_API_KEY
      ? makeWorkspaceInvitationSender(env.RESEND_API_KEY)
      : async () => { /* no-op: email not configured */ },
    siteUrl:        env.SITE_URL ?? 'https://thewhetstone.review',
  });
};
