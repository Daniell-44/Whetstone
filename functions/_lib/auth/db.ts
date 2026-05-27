export interface DbUser {
  id:         string;
  email:      string;
  created_at: string;
}

export interface DbSession {
  id:         string;
  user_id:    string;
  created_at: string;
  expires_at: string;
}

export interface DbMagicLink {
  id:          string;
  user_id:     string;
  token_hash:  string;
  created_at:  string;
  expires_at:  string;
  consumed_at: string | null;
}

// Narrow interface so the auth helpers work against D1 in production
// and a Map-backed fake in tests.
export interface AuthDb {
  findUserByEmail(email: string): Promise<DbUser | null>;
  findUserById(id: string): Promise<DbUser | null>;
  createUser(id: string, email: string): Promise<void>;
  createMagicLink(id: string, userId: string, tokenHash: string, expiresAt: string): Promise<void>;
  findMagicLinkByTokenHash(tokenHash: string): Promise<DbMagicLink | null>;
  markMagicLinkConsumed(id: string): Promise<void>;
  createSession(id: string, userId: string, expiresAt: string): Promise<void>;
  findSessionById(id: string): Promise<DbSession | null>;
  deleteSession(id: string): Promise<void>;
  extendSession(id: string, expiresAt: string): Promise<void>;
}

export function makeAuthDb(d1: D1Database): AuthDb {
  return {
    findUserByEmail: (email) =>
      d1.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<DbUser>(),

    findUserById: (id) =>
      d1.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<DbUser>(),

    createUser: async (id, email) => {
      await d1.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(id, email).run();
    },

    createMagicLink: async (id, userId, tokenHash, expiresAt) => {
      await d1
        .prepare('INSERT INTO magic_links (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
        .bind(id, userId, tokenHash, expiresAt)
        .run();
    },

    findMagicLinkByTokenHash: (tokenHash) =>
      d1.prepare('SELECT * FROM magic_links WHERE token_hash = ?').bind(tokenHash).first<DbMagicLink>(),

    markMagicLinkConsumed: async (id) => {
      await d1
        .prepare("UPDATE magic_links SET consumed_at = datetime('now') WHERE id = ?")
        .bind(id)
        .run();
    },

    createSession: async (id, userId, expiresAt) => {
      await d1
        .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        .bind(id, userId, expiresAt)
        .run();
    },

    findSessionById: (id) =>
      d1.prepare('SELECT * FROM sessions WHERE id = ?').bind(id).first<DbSession>(),

    deleteSession: async (id) => {
      await d1.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    },

    extendSession: async (id, expiresAt) => {
      await d1
        .prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
        .bind(expiresAt, id)
        .run();
    },
  };
}
