-- Opt-in product analytics. Privacy-promise compliant because:
--   (1) Only fires when the user has explicitly turned analytics on
--   (2) No raw text content stored — only event names + structured metadata
--   (3) No IP storage; only an anonymous session id (hashed)
--   (4) Per-event TTL via a scheduled purge of rows older than 90 days

CREATE TABLE IF NOT EXISTS analytics_events (
  id            TEXT    NOT NULL PRIMARY KEY,
  timestamp     INTEGER NOT NULL,                  -- epoch ms
  session_hash  TEXT    NOT NULL,                  -- short anonymous session marker (rotates per browser session)
  user_id       TEXT,                              -- nullable; only present for signed-in users who opted in
  event_name    TEXT    NOT NULL,                  -- e.g. 'audit_completed', 'sample_picked'
  path          TEXT,                              -- /reader, /creator/studio, etc.
  metadata      TEXT                               -- JSON blob; no PII; whitelisted keys only
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_time
  ON analytics_events(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event
  ON analytics_events(event_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user
  ON analytics_events(user_id, timestamp DESC);
