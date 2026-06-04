import type { ApiKeyDb, DbApiKey } from './types';

export function makeApiKeyDb(d1: D1Database): ApiKeyDb {
  return {
    createKey: async (key) => {
      await d1
        .prepare(
          'INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(key.id, key.user_id, key.name, key.key_prefix, key.key_hash, key.created_at)
        .run();
    },

    findByHash: (hash) =>
      d1
        .prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL')
        .bind(hash)
        .first<DbApiKey>(),

    listForUser: async (userId) => {
      const result = await d1
        .prepare('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC')
        .bind(userId)
        .all<DbApiKey>();
      return result.results;
    },

    revokeKey: async (keyId, userId) => {
      await d1
        .prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ?')
        .bind(Date.now(), keyId, userId)
        .run();
    },

    touchLastUsed: async (keyId, now) => {
      await d1
        .prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
        .bind(now, keyId)
        .run();
    },
  };
}
