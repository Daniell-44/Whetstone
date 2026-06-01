CREATE TABLE finding_actions (
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
CREATE INDEX idx_finding_actions_doc ON finding_actions(document_id, lens, match_key);
CREATE INDEX idx_finding_actions_user ON finding_actions(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_finding_actions_unique ON finding_actions(document_id, lens, match_key);
