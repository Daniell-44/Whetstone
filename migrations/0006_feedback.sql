CREATE TABLE feedback (
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
CREATE INDEX idx_feedback_lens_type ON feedback(target_lens, feedback_type, created_at DESC);
CREATE INDEX idx_feedback_user      ON feedback(user_id, created_at DESC);
CREATE INDEX idx_feedback_document  ON feedback(document_id, version_id);
