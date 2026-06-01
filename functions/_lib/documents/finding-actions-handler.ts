import type { FindingActionDb, FindingActionType } from './finding-actions';

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ALLOWED_LENSES = new Set(['audit', 'counterargument']);

// ---------------------------------------------------------------------------
// Deps interfaces
// ---------------------------------------------------------------------------

export interface FindingActionsListDeps {
  db:                 FindingActionDb;
  documentId:         string;
  getSession:         (req: Request) => Promise<{ userId: string } | null>;
  getDocumentOwnerId: (docId: string) => Promise<string | null>;
}

export interface FindingActionsUpsertDeps extends FindingActionsListDeps {
  newId: () => string;
}

export interface FindingActionsDeleteDeps {
  db:         FindingActionDb;
  getSession: (req: Request) => Promise<{ userId: string } | null>;
}

// ---------------------------------------------------------------------------
// GET — list actions for a document
// ---------------------------------------------------------------------------

export async function handleListFindingActions(
  req:  Request,
  deps: FindingActionsListDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);
  }

  const ownerId = await deps.getDocumentOwnerId(deps.documentId);
  if (!ownerId || ownerId !== session.userId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const rows = await deps.db.listActionsForDocument(deps.documentId, session.userId);

  const actions: Record<string, { id: string; action: string; reason: string | null; updatedAt: number }> = {};
  for (const r of rows) {
    actions[`${r.lens}:${r.match_key}`] = {
      id:        r.id,
      action:    r.action,
      reason:    r.reason,
      updatedAt: r.updated_at,
    };
  }

  return json({ ok: true, actions });
}

// ---------------------------------------------------------------------------
// POST — upsert (create or update) an action
// ---------------------------------------------------------------------------

export async function handleUpsertFindingAction(
  req:  Request,
  deps: FindingActionsUpsertDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);
  }

  const ownerId = await deps.getDocumentOwnerId(deps.documentId);
  if (!ownerId || ownerId !== session.userId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const { lens, matchKey, action, reason } = body as {
    lens?:     string;
    matchKey?: string;
    action?:   string;
    reason?:   string | null;
  };

  if (!lens || !ALLOWED_LENSES.has(lens)) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: `lens must be one of: ${[...ALLOWED_LENSES].join(', ')}` } }, 400);
  }
  if (!matchKey || typeof matchKey !== 'string' || matchKey.trim().length === 0) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'matchKey is required' } }, 400);
  }
  if (!action || !['addressed', 'dismissed', 'reflagged'].includes(action)) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'action must be addressed, dismissed, or reflagged' } }, 400);
  }

  const row = await deps.db.upsertAction({
    id:         deps.newId(),
    userId:     session.userId,
    documentId: deps.documentId,
    lens,
    matchKey:   matchKey.trim(),
    action:     action as FindingActionType,
    reason:     reason ?? null,
  });

  return json({
    ok: true,
    action: {
      id:        row.id,
      lens:      row.lens,
      matchKey:  row.match_key,
      action:    row.action,
      reason:    row.reason,
      updatedAt: row.updated_at,
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE — remove an action
// ---------------------------------------------------------------------------

export async function handleDeleteFindingAction(
  req:  Request,
  deps: FindingActionsDeleteDeps & { actionId: string },
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);
  }

  const deleted = await deps.db.deleteAction(deps.actionId, session.userId);
  if (!deleted) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Action not found' } }, 404);
  }

  return json({ ok: true });
}
