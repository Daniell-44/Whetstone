-- Community + editor takes on topic pages.
--
-- kind:   'community' (signed-in users) or 'editor' (the Whetstone's voice, admin-posted)
-- status: 'pending' (awaiting moderation) | 'approved' (shown) | 'rejected' (hidden)
--         The default is set by the moderation model chosen at build time.
--
-- Apply to BOTH databases:
--   npx wrangler d1 execute whetstone-users         --file=migrations/0018_topic_takes.sql --remote
--   npx wrangler d1 execute whetstone-users-preview --file=migrations/0018_topic_takes.sql --remote

CREATE TABLE IF NOT EXISTS topic_takes (
  id           TEXT PRIMARY KEY,
  topic_slug   TEXT NOT NULL,
  user_id      TEXT,                  -- null allowed for editor takes
  display_name TEXT,                  -- how the take is attributed in the UI
  body         TEXT NOT NULL,         -- the one-line take
  kind         TEXT NOT NULL DEFAULT 'community',
  status       TEXT NOT NULL DEFAULT 'approved',
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topic_takes_slug   ON topic_takes(topic_slug, status, created_at);
CREATE INDEX IF NOT EXISTS idx_topic_takes_user   ON topic_takes(user_id, topic_slug);
