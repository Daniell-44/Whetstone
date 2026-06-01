export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../../../functions/_lib/auth/db';
import { makeDocumentDb } from '../../../../../../functions/_lib/documents/db';
import { makeFindingActionDb } from '../../../../../../functions/_lib/documents/finding-actions';
import {
  handleListFindingActions,
  handleUpsertFindingAction,
} from '../../../../../../functions/_lib/documents/finding-actions-handler';
import { getSessionFromRequest } from '../../../../../../functions/_lib/auth/sessions';

function newId() { return crypto.randomUUID(); }

function makeDeps(request: Request, docId: string) {
  const authDb  = makeAuthDb(env.DB);
  const docDb   = makeDocumentDb(env.DB);
  const actionDb = makeFindingActionDb(env.DB);

  return {
    db:         actionDb,
    documentId: docId,
    getSession: (req: Request) =>
      getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    getDocumentOwnerId: async (id: string) => {
      const doc = await docDb.getDocumentById(id);
      return doc ? doc.user_id : null;
    },
  };
}

// GET /api/documents/[id]/finding-actions
export const GET: APIRoute = async ({ request, params }) => {
  const deps = makeDeps(request, params.id!);
  return handleListFindingActions(request, deps);
};

// POST /api/documents/[id]/finding-actions
export const POST: APIRoute = async ({ request, params }) => {
  const deps = makeDeps(request, params.id!);
  return handleUpsertFindingAction(request, { ...deps, newId });
};
