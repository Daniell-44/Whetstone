export interface ServerError {
  id:         string;
  timestamp:  number;
  method:     string;
  path:       string;
  status:     number;
  error_type: string | null;
  message:    string | null;
  stack:      string | null;
  ip_hash:    string | null;
  user_agent: string | null;
}

export interface ErrorDb {
  logError(err: ServerError): Promise<void>;
  listRecent(limit?: number): Promise<ServerError[]>;
  countByPath(since: number): Promise<Array<{ path: string; count: number }>>;
  purgeOlderThan(timestamp: number): Promise<number>;
}

export function makeErrorDb(d1: D1Database): ErrorDb {
  return {
    logError: async (err) => {
      await d1
        .prepare(
          'INSERT INTO server_errors (id, timestamp, method, path, status, error_type, message, stack, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          err.id,
          err.timestamp,
          err.method,
          err.path,
          err.status,
          err.error_type,
          err.message?.slice(0, 500) ?? null,
          err.stack?.slice(0, 2000) ?? null,
          err.ip_hash,
          err.user_agent?.slice(0, 200) ?? null,
        )
        .run();
    },

    listRecent: async (limit = 50) => {
      const result = await d1
        .prepare('SELECT * FROM server_errors ORDER BY timestamp DESC LIMIT ?')
        .bind(limit)
        .all<ServerError>();
      return result.results;
    },

    countByPath: async (since) => {
      const result = await d1
        .prepare(
          'SELECT path, COUNT(*) as count FROM server_errors WHERE timestamp > ? GROUP BY path ORDER BY count DESC',
        )
        .bind(since)
        .all<{ path: string; count: number }>();
      return result.results;
    },

    purgeOlderThan: async (timestamp) => {
      const result = await d1
        .prepare('DELETE FROM server_errors WHERE timestamp < ?')
        .bind(timestamp)
        .run();
      return result.meta.changes ?? 0;
    },
  };
}
