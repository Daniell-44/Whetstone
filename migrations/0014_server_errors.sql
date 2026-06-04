-- Server error tracking — persistent error log in D1.
-- Replaces wrangler tail for post-hoc debugging.
CREATE TABLE IF NOT EXISTS server_errors (
  id         TEXT    NOT NULL PRIMARY KEY,
  timestamp  INTEGER NOT NULL,                    -- epoch ms
  method     TEXT    NOT NULL,                    -- GET, POST, etc.
  path       TEXT    NOT NULL,                    -- /api/audit, /api/keys, etc.
  status     INTEGER NOT NULL,                    -- HTTP status returned
  error_type TEXT,                                -- error class name or code
  message    TEXT,                                -- error message (first 500 chars)
  stack      TEXT,                                -- stack trace (first 2000 chars, nullable)
  ip_hash    TEXT,                                -- SHA-256 of IP (for grouping, not identification)
  user_agent TEXT                                 -- truncated UA string
);

CREATE INDEX IF NOT EXISTS idx_server_errors_time
  ON server_errors(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_server_errors_path
  ON server_errors(path, timestamp DESC);
