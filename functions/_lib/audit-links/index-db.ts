import { TTL_SECONDS } from './storage';

// ---------------------------------------------------------------------------
// D1 side-index for share links (audit permalinks) created by signed-in users.
//
// The permalink payload lives ONLY in KV (storage.ts) with a 30-day TTL and no
// user association. This index is written at creation time so a signed-in user
// can list and revoke their own links. Anonymous shares are never indexed, and
// links created before the index existed cannot be listed.
//
// expires_at mirrors the KV TTL (created_at + TTL_SECONDS, in epoch ms) so the
// list can exclude rows whose KV entry has already lapsed without touching KV.
// ---------------------------------------------------------------------------

export interface AuditLinkIndexRow {
  id:         string;
  user_id:    string;
  title:      string | null;
  created_at: number; // epoch ms
  expires_at: number; // epoch ms
  revoked:    number; // 0 | 1
}

export interface AuditLinkIndexDb {
  /** Record a newly created share link. expires_at is derived from the KV TTL. */
  insert(id: string, userId: string, title: string | null, createdAt: number): Promise<void>;
  /** Unexpired links for the user, newest first. Purges the user's expired
     rows first — index rows must not outlive the KV payloads they point at. */
  listForUser(userId: string, now: number): Promise<AuditLinkIndexRow[]>;
  getById(id: string): Promise<AuditLinkIndexRow | null>;
  /** Hard-delete, scoped to the owner: revocation removes the row entirely
     (nothing is gained by keeping it, and the title may be user-authored).
     The user_id scope makes ownership structural, not caller convention. */
  deleteRow(id: string, userId: string): Promise<void>;
}

export function makeAuditLinkIndexDb(d1: D1Database): AuditLinkIndexDb {
  return {
    insert: async (id, userId, title, createdAt) => {
      await d1
        .prepare('INSERT INTO audit_link_index (id, user_id, title, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, ?, 0)')
        .bind(id, userId, title, createdAt, createdAt + TTL_SECONDS * 1000)
        .run();
    },

    listForUser: async (userId, now) => {
      // Opportunistic purge: expired rows are dead weight referencing KV
      // payloads that no longer exist. Deleting on read keeps the table from
      // accumulating user-linked rows forever without needing a cron.
      await d1
        .prepare('DELETE FROM audit_link_index WHERE user_id = ? AND expires_at <= ?')
        .bind(userId, now)
        .run();
      const result = await d1
        .prepare('SELECT * FROM audit_link_index WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC')
        .bind(userId, now)
        .all<AuditLinkIndexRow>();
      return result.results;
    },

    getById: (id) =>
      d1.prepare('SELECT * FROM audit_link_index WHERE id = ?').bind(id).first<AuditLinkIndexRow>(),

    deleteRow: async (id, userId) => {
      await d1
        .prepare('DELETE FROM audit_link_index WHERE id = ? AND user_id = ?')
        .bind(id, userId)
        .run();
    },
  };
}
