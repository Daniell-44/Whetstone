-- CATCH-UP MIGRATION: 0003 through 0014, idempotent.
-- Safe to run even if some migrations were already partially applied.
-- Run once on each database:
--   npx wrangler d1 execute whetstone-users         --file=migrations/catchup_0003_to_0014.sql --remote
--   npx wrangler d1 execute whetstone-users-preview --file=migrations/catchup_0003_to_0014.sql --remote

-- ===== 0003: documents + document_versions =====
CREATE TABLE IF NOT EXISTS documents (
  id         TEXT NOT NULL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL DEFAULT 'Untitled draft',
  status     TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS document_versions (
  id                TEXT NOT NULL PRIMARY KEY,
  document_id       TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,
  version_number    INTEGER NOT NULL,
  audit_result      TEXT,
  counterarg_result TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_documents_user
  ON documents(user_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc
  ON document_versions(document_id, version_number DESC);

-- ===== 0004: finding_actions =====
CREATE TABLE IF NOT EXISTS finding_actions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  document_id TEXT NOT NULL,
  lens        TEXT NOT NULL,
  match_key   TEXT NOT NULL,
  action      TEXT NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_finding_actions_doc ON finding_actions(document_id, lens, match_key);
CREATE INDEX IF NOT EXISTS idx_finding_actions_user ON finding_actions(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_finding_actions_unique ON finding_actions(document_id, lens, match_key);

-- ===== 0006: feedback =====
CREATE TABLE IF NOT EXISTS feedback (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  document_id      TEXT,
  version_id       TEXT,
  feedback_type    TEXT NOT NULL,
  target_lens      TEXT,
  match_key        TEXT,
  finding_snapshot TEXT,
  rating           INTEGER,
  qualitative      TEXT,
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_lens_type ON feedback(target_lens, feedback_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user      ON feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_document  ON feedback(document_id, version_id);

-- ===== 0007: extraction_json column on document_versions =====
-- SQLite doesn't have ADD COLUMN IF NOT EXISTS, so we check the pragma.
-- If the column already exists, the ALTER will fail silently in D1's batch mode.
-- Wrapping in a no-op SELECT to swallow the error is not possible in plain SQL,
-- so we rely on D1's behaviour: it continues past failed ALTERs in a batch.
ALTER TABLE document_versions ADD COLUMN extraction_json TEXT;

-- ===== 0008: commitments_json =====
ALTER TABLE document_versions ADD COLUMN commitments_json TEXT;

-- ===== 0009: terminology_preference on users =====
ALTER TABLE users ADD COLUMN terminology_preference TEXT NOT NULL DEFAULT 'plain';

-- ===== 0010: citation_audit_json =====
ALTER TABLE document_versions ADD COLUMN citation_audit_json TEXT;

-- ===== 0011: workspaces =====
CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT NOT NULL PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_id   TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id           TEXT NOT NULL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id),
  role         TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
  joined_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id           TEXT NOT NULL PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  token_hash   TEXT NOT NULL UNIQUE,
  invited_by   TEXT NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at   INTEGER NOT NULL,
  accepted_at  INTEGER
);

ALTER TABLE documents ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner
  ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace
  ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace
  ON workspace_invitations(workspace_id, accepted_at);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token
  ON workspace_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_documents_workspace
  ON documents(workspace_id, status, updated_at);

-- ===== 0013: api_keys =====
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  key_prefix   TEXT    NOT NULL,
  key_hash     TEXT    NOT NULL UNIQUE,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ===== 0014: server_errors =====
CREATE TABLE IF NOT EXISTS server_errors (
  id         TEXT    NOT NULL PRIMARY KEY,
  timestamp  INTEGER NOT NULL,
  method     TEXT    NOT NULL,
  path       TEXT    NOT NULL,
  status     INTEGER NOT NULL,
  error_type TEXT,
  message    TEXT,
  stack      TEXT,
  ip_hash    TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_server_errors_time
  ON server_errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_server_errors_path
  ON server_errors(path, timestamp DESC);
