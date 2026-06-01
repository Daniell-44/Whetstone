import type { D1Database } from '@cloudflare/workers-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FindingActionType = 'addressed' | 'dismissed' | 'reflagged';

export interface FindingActionRow {
  id:          string;
  user_id:     string;
  document_id: string;
  lens:        string;
  match_key:   string;
  action:      FindingActionType;
  reason:      string | null;
  created_at:  number;
  updated_at:  number;
}

export interface FindingActionDb {
  upsertAction(params: {
    id:         string;
    userId:     string;
    documentId: string;
    lens:       string;
    matchKey:   string;
    action:     FindingActionType;
    reason?:    string | null;
  }): Promise<FindingActionRow>;

  getActionById(id: string): Promise<FindingActionRow | null>;

  listActionsForDocument(documentId: string, userId: string): Promise<FindingActionRow[]>;

  deleteAction(id: string, userId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// D1-backed implementation
// ---------------------------------------------------------------------------

export function makeFindingActionDb(db: D1Database): FindingActionDb {
  return {
    async upsertAction({ id, userId, documentId, lens, matchKey, action, reason = null }) {
      const now = Date.now();
      await db
        .prepare(
          `INSERT INTO finding_actions (id, user_id, document_id, lens, match_key, action, reason, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (document_id, lens, match_key)
           DO UPDATE SET action = excluded.action, reason = excluded.reason, updated_at = excluded.updated_at`,
        )
        .bind(id, userId, documentId, lens, matchKey, action, reason, now, now)
        .run();

      const row = await db
        .prepare(
          `SELECT * FROM finding_actions WHERE document_id = ? AND lens = ? AND match_key = ?`,
        )
        .bind(documentId, lens, matchKey)
        .first<FindingActionRow>();

      if (!row) throw new Error('upsertAction: row not found after insert');
      return row;
    },

    async getActionById(id) {
      return db
        .prepare(`SELECT * FROM finding_actions WHERE id = ?`)
        .bind(id)
        .first<FindingActionRow>() as Promise<FindingActionRow | null>;
    },

    async listActionsForDocument(documentId, userId) {
      const result = await db
        .prepare(`SELECT * FROM finding_actions WHERE document_id = ? AND user_id = ?`)
        .bind(documentId, userId)
        .all<FindingActionRow>();
      return result.results ?? [];
    },

    async deleteAction(id, userId) {
      const row = await db
        .prepare(`SELECT * FROM finding_actions WHERE id = ?`)
        .bind(id)
        .first<FindingActionRow>();
      if (!row || row.user_id !== userId) return false;
      await db.prepare(`DELETE FROM finding_actions WHERE id = ?`).bind(id).run();
      return true;
    },
  };
}
