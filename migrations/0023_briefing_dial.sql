-- Reader dial counts (Decision 19-B, 2026-08-08). One row per briefing per
-- step: an anonymous tally, no user linkage by design ("one anonymous tap,
-- stored as a count"). Results are gated in the API until fifty answers.
CREATE TABLE IF NOT EXISTS briefing_dial_votes (
  slug       TEXT    NOT NULL,
  step       INTEGER NOT NULL,
  n          INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (slug, step)
);
