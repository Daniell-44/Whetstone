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
