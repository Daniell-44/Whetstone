-- Global qualitative site feedback (the /feedback page).
-- Distinct from the `feedback` table (0006), which is authenticated engine/lens
-- feedback tied to documents + findings. This one is open-ended visitor feedback
-- about the site/briefings: anonymous-friendly, so user_id is nullable.
CREATE TABLE site_feedback (
  id          TEXT PRIMARY KEY,
  message     TEXT NOT NULL,
  email       TEXT,
  source_path TEXT,
  user_id     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_site_feedback_created ON site_feedback(created_at DESC);
