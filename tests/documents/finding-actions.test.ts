import { describe, it, expect } from 'vitest';
import type { FindingActionDb, FindingActionRow, FindingActionType } from '../../functions/_lib/documents/finding-actions';
import {
  handleListFindingActions,
  handleUpsertFindingAction,
  handleDeleteFindingAction,
  type FindingActionsListDeps,
  type FindingActionsUpsertDeps,
  type FindingActionsDeleteDeps,
} from '../../functions/_lib/documents/finding-actions-handler';

// ---------------------------------------------------------------------------
// Fake FindingActionDb
// ---------------------------------------------------------------------------

function makeFakeActionDb(): FindingActionDb & { rows: Map<string, FindingActionRow> } {
  const rows = new Map<string, FindingActionRow>();

  const db: FindingActionDb = {
    async upsertAction({ id, userId, documentId, lens, matchKey, action, reason = null }) {
      const existing = [...rows.values()].find(
        r => r.document_id === documentId && r.lens === lens && r.match_key === matchKey,
      );
      const now = Date.now();
      if (existing) {
        const updated: FindingActionRow = { ...existing, action, reason, updated_at: now };
        rows.set(existing.id, updated);
        return updated;
      }
      const row: FindingActionRow = {
        id, user_id: userId, document_id: documentId, lens, match_key: matchKey,
        action, reason, created_at: now, updated_at: now,
      };
      rows.set(id, row);
      return row;
    },

    async getActionById(id) {
      return rows.get(id) ?? null;
    },

    async listActionsForDocument(documentId, userId) {
      return [...rows.values()].filter(r => r.document_id === documentId && r.user_id === userId);
    },

    async deleteAction(id, userId) {
      const row = rows.get(id);
      if (!row || row.user_id !== userId) return false;
      rows.delete(id);
      return true;
    },
  };

  return Object.assign(db, { rows });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
function newId() { return `id-${++idCounter}`; }
function jsonReq(body: unknown, method = 'POST'): Request {
  return new Request('https://test.example', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function getReq(): Request {
  return new Request('https://test.example', { method: 'GET' });
}
function deleteReq(): Request {
  return new Request('https://test.example', { method: 'DELETE' });
}

const SESSION_USER = 'user-1';
const OTHER_USER   = 'user-2';
const DOC_ID       = 'doc-abc';

function makeListDeps(
  db: FindingActionDb,
  opts: { authed?: boolean; owns?: boolean } = {},
): FindingActionsListDeps {
  const { authed = true, owns = true } = opts;
  return {
    db,
    documentId: DOC_ID,
    getSession: async () => authed ? { userId: SESSION_USER } : null,
    getDocumentOwnerId: async () => owns ? SESSION_USER : null,
  };
}

function makeUpsertDeps(
  db: FindingActionDb,
  opts: { authed?: boolean; owns?: boolean } = {},
): FindingActionsUpsertDeps {
  return { ...makeListDeps(db, opts), newId };
}

function makeDeleteDeps(
  db: FindingActionDb,
  opts: { authed?: boolean } = {},
): FindingActionsDeleteDeps & { actionId: string } {
  const { authed = true } = opts;
  return {
    db,
    actionId: 'id-1',
    getSession: async () => authed ? { userId: SESSION_USER } : null,
  };
}

// ---------------------------------------------------------------------------
// handleListFindingActions
// ---------------------------------------------------------------------------

describe('handleListFindingActions', () => {
  it('returns 401 when not authenticated', async () => {
    const db  = makeFakeActionDb();
    const res = await handleListFindingActions(getReq(), makeListDeps(db, { authed: false }));
    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('returns 404 when document not owned by user', async () => {
    const db  = makeFakeActionDb();
    const res = await handleListFindingActions(getReq(), makeListDeps(db, { owns: false }));
    expect(res.status).toBe(404);
  });

  it('returns empty actions map when no actions exist', async () => {
    const db  = makeFakeActionDb();
    const res = await handleListFindingActions(getReq(), makeListDeps(db));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; actions: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(Object.keys(body.actions)).toHaveLength(0);
  });

  it('returns actions keyed by lens:matchKey', async () => {
    const db  = makeFakeActionDb();
    await db.upsertAction({
      id: 'r1', userId: SESSION_USER, documentId: DOC_ID,
      lens: 'audit', matchKey: 'ad-hominem::foo', action: 'dismissed',
    });
    const res  = await handleListFindingActions(getReq(), makeListDeps(db));
    const body = await res.json() as { ok: boolean; actions: Record<string, { action: string }> };
    expect(body.ok).toBe(true);
    expect(body.actions['audit:ad-hominem::foo'].action).toBe('dismissed');
  });
});

// ---------------------------------------------------------------------------
// handleUpsertFindingAction
// ---------------------------------------------------------------------------

describe('handleUpsertFindingAction — auth', () => {
  it('returns 401 when not authenticated', async () => {
    const db  = makeFakeActionDb();
    const res = await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', matchKey: 'k', action: 'addressed' }),
      makeUpsertDeps(db, { authed: false }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when document not owned by user', async () => {
    const db  = makeFakeActionDb();
    const res = await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', matchKey: 'k', action: 'addressed' }),
      makeUpsertDeps(db, { owns: false }),
    );
    expect(res.status).toBe(404);
  });
});

describe('handleUpsertFindingAction — validation', () => {
  it('returns 400 for invalid JSON body', async () => {
    const db  = makeFakeActionDb();
    const req = new Request('https://test.example', { method: 'POST', body: 'not-json' });
    const res = await handleUpsertFindingAction(req, makeUpsertDeps(db));
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown lens', async () => {
    const db  = makeFakeActionDb();
    const res = await handleUpsertFindingAction(
      jsonReq({ lens: 'unknown', matchKey: 'k', action: 'addressed' }),
      makeUpsertDeps(db),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 for missing matchKey', async () => {
    const db  = makeFakeActionDb();
    const res = await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', action: 'addressed' }),
      makeUpsertDeps(db),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for blank matchKey', async () => {
    const db  = makeFakeActionDb();
    const res = await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', matchKey: '   ', action: 'addressed' }),
      makeUpsertDeps(db),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action value', async () => {
    const db  = makeFakeActionDb();
    const res = await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', matchKey: 'k', action: 'deleted' }),
      makeUpsertDeps(db),
    );
    expect(res.status).toBe(400);
  });

  it('accepts lens "counterargument"', async () => {
    const db  = makeFakeActionDb();
    const res = await handleUpsertFindingAction(
      jsonReq({ lens: 'counterargument', matchKey: 'k', action: 'addressed' }),
      makeUpsertDeps(db),
    );
    expect(res.status).toBe(200);
  });
});

describe('handleUpsertFindingAction — success', () => {
  it('creates a new action and returns it', async () => {
    const db  = makeFakeActionDb();
    const res = await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', matchKey: 'ad-hominem::quote', action: 'addressed' }),
      makeUpsertDeps(db),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; action: { action: string; lens: string; matchKey: string } };
    expect(body.ok).toBe(true);
    expect(body.action.action).toBe('addressed');
    expect(body.action.lens).toBe('audit');
    expect(body.action.matchKey).toBe('ad-hominem::quote');
  });

  it('updates existing action for the same document+lens+matchKey', async () => {
    const db  = makeFakeActionDb();
    const deps = makeUpsertDeps(db);

    await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', matchKey: 'k', action: 'addressed' }),
      deps,
    );
    const res2 = await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', matchKey: 'k', action: 'dismissed' }),
      deps,
    );
    const body = await res2.json() as { action: { action: string } };
    expect(body.action.action).toBe('dismissed');
    expect(db.rows.size).toBe(1);
  });

  it('accepts all three action types', async () => {
    const actions: FindingActionType[] = ['addressed', 'dismissed', 'reflagged'];
    for (const action of actions) {
      const db  = makeFakeActionDb();
      const res = await handleUpsertFindingAction(
        jsonReq({ lens: 'audit', matchKey: 'k', action }),
        makeUpsertDeps(db),
      );
      expect(res.status).toBe(200);
    }
  });

  it('trims whitespace from matchKey', async () => {
    const db  = makeFakeActionDb();
    await handleUpsertFindingAction(
      jsonReq({ lens: 'audit', matchKey: '  k  ', action: 'addressed' }),
      makeUpsertDeps(db),
    );
    const row = [...db.rows.values()][0];
    expect(row.match_key).toBe('k');
  });
});

// ---------------------------------------------------------------------------
// handleDeleteFindingAction
// ---------------------------------------------------------------------------

describe('handleDeleteFindingAction', () => {
  it('returns 401 when not authenticated', async () => {
    const db  = makeFakeActionDb();
    const res = await handleDeleteFindingAction(deleteReq(), makeDeleteDeps(db, { authed: false }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when action does not exist', async () => {
    const db  = makeFakeActionDb();
    const res = await handleDeleteFindingAction(deleteReq(), { ...makeDeleteDeps(db), actionId: 'nonexistent' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when action belongs to a different user', async () => {
    const db = makeFakeActionDb();
    await db.upsertAction({
      id: 'id-1', userId: OTHER_USER, documentId: DOC_ID,
      lens: 'audit', matchKey: 'k', action: 'addressed',
    });
    const res = await handleDeleteFindingAction(deleteReq(), makeDeleteDeps(db));
    expect(res.status).toBe(404);
  });

  it('deletes owned action and returns ok', async () => {
    const db = makeFakeActionDb();
    await db.upsertAction({
      id: 'id-1', userId: SESSION_USER, documentId: DOC_ID,
      lens: 'audit', matchKey: 'k', action: 'addressed',
    });
    const res  = await handleDeleteFindingAction(deleteReq(), makeDeleteDeps(db));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(db.rows.size).toBe(0);
  });
});
