-- Index of share links (audit permalinks) created by signed-in users.
-- The permalink payload itself lives ONLY in KV (functions/_lib/audit-links/
-- storage.ts, 30-day TTL, no user association). This table is a D1 side-index
-- written at creation time so a signed-in user can list and revoke their own
-- links. Links created before this index existed cannot be listed (the KV
-- namespace has no user association to backfill from); they keep working
-- until their TTL expires.
CREATE TABLE audit_link_index (
  id         TEXT PRIMARY KEY,          -- the audit-link short id (KV key suffix)
  user_id    TEXT NOT NULL,
  title      TEXT,
  created_at INTEGER NOT NULL,          -- epoch ms
  expires_at INTEGER NOT NULL,          -- epoch ms (created_at + KV TTL)
  revoked    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_audit_link_index_user ON audit_link_index(user_id, created_at DESC);
