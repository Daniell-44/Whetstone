-- Feedback from signed-out users.
--
-- The tool no longer requires an account, so the overwhelming majority of
-- audits are run anonymously. feedback.user_id was NOT NULL, which meant the
-- thumbs-up/down signal that tunes the engine could only ever come from the
-- small minority who sign in. This makes it nullable: NULL = anonymous.
--
-- SQLite cannot drop a NOT NULL constraint in place, so the table is rebuilt.
-- Existing rows are preserved verbatim; every one of them keeps its user_id.

PRAGMA foreign_keys=OFF;

CREATE TABLE feedback_new (
  id               TEXT PRIMARY KEY,
  user_id          TEXT,               -- NULL = submitted by a signed-out visitor
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

INSERT INTO feedback_new
  SELECT id, user_id, document_id, version_id, feedback_type, target_lens,
         match_key, finding_snapshot, rating, qualitative, created_at
  FROM feedback;

DROP TABLE feedback;
ALTER TABLE feedback_new RENAME TO feedback;

CREATE INDEX idx_feedback_lens_type ON feedback(target_lens, feedback_type, created_at DESC);
CREATE INDEX idx_feedback_user      ON feedback(user_id, created_at DESC);
CREATE INDEX idx_feedback_document  ON feedback(document_id, version_id);

PRAGMA foreign_keys=ON;
