-- CS-15: Multi-seat workspaces
-- A workspace is the unit that owns documents and has a subscription.
-- One subscription on any member entitles the whole workspace.
--
-- Apply to BOTH databases after deploying:
--   wrangler d1 execute whetstone-users         --file=migrations/0011_workspaces.sql --remote
--   wrangler d1 execute whetstone-users-preview --file=migrations/0011_workspaces.sql --remote

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

-- Invitation tokens are stored as SHA-256 hashes (same pattern as magic links).
-- expires_at is epoch ms; accepted_at null = still pending.
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

-- Soft-association: documents can belong to a workspace.
-- Null = pre-backfill personal document; backfill sets this via the admin endpoint.
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
