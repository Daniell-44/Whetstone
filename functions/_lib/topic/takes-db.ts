// Topic-takes data layer (D1). Community + editor takes on topic pages.

export type TakeKind   = 'community' | 'editor';
export type TakeStatus = 'pending' | 'approved' | 'rejected';

export interface TopicTake {
  id:           string;
  topic_slug:   string;
  user_id:      string | null;
  display_name: string | null;
  body:         string;
  kind:         TakeKind;
  status:       TakeStatus;
  created_at:   number;
}

export interface TopicTakesDb {
  /** Approved takes for a topic, newest first, split is done by the caller. */
  listApproved(slug: string): Promise<TopicTake[]>;
  /** All takes for a topic regardless of status (admin moderation view). */
  listAll(slug: string): Promise<TopicTake[]>;
  /** Takes across ALL topics with a given status (admin moderation queue). */
  listByStatus(status: TakeStatus, limit?: number): Promise<TopicTake[]>;
  /** A user's existing take on a topic, if any (one per user per topic). */
  findUserTake(slug: string, userId: string): Promise<TopicTake | null>;
  insert(take: TopicTake): Promise<void>;
  updateBody(id: string, body: string): Promise<void>;
  setStatus(id: string, status: TakeStatus): Promise<void>;
  delete(id: string): Promise<void>;
}

export function makeTopicTakesDb(d1: D1Database): TopicTakesDb {
  return {
    listApproved: (slug) =>
      d1.prepare(
        `SELECT * FROM topic_takes WHERE topic_slug = ? AND status = 'approved'
         ORDER BY kind = 'editor' DESC, created_at DESC`,
      ).bind(slug).all<TopicTake>().then(r => r.results ?? []),

    listAll: (slug) =>
      d1.prepare(
        `SELECT * FROM topic_takes WHERE topic_slug = ? ORDER BY created_at DESC`,
      ).bind(slug).all<TopicTake>().then(r => r.results ?? []),

    listByStatus: (status, limit = 200) =>
      d1.prepare(
        `SELECT * FROM topic_takes WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
      ).bind(status, limit).all<TopicTake>().then(r => r.results ?? []),

    findUserTake: (slug, userId) =>
      d1.prepare(
        `SELECT * FROM topic_takes WHERE topic_slug = ? AND user_id = ? AND kind = 'community' LIMIT 1`,
      ).bind(slug, userId).first<TopicTake>(),

    insert: async (t) => {
      await d1.prepare(
        `INSERT INTO topic_takes (id, topic_slug, user_id, display_name, body, kind, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(t.id, t.topic_slug, t.user_id, t.display_name, t.body, t.kind, t.status, t.created_at).run();
    },

    updateBody: async (id, body) => {
      await d1.prepare(`UPDATE topic_takes SET body = ? WHERE id = ?`).bind(body, id).run();
    },

    setStatus: async (id, status) => {
      await d1.prepare(`UPDATE topic_takes SET status = ? WHERE id = ?`).bind(status, id).run();
    },

    delete: async (id) => {
      await d1.prepare(`DELETE FROM topic_takes WHERE id = ?`).bind(id).run();
    },
  };
}
