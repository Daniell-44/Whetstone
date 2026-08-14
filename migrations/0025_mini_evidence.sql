-- The evidence, not just the outcome.
--
-- Migration 0024 recorded what each run PRODUCED. An audit on 13 August 2026
-- found it was throwing away the things that would actually let the pipeline be
-- improved. This adds them. It is deliberately a separate migration so the gap
-- is visible in the history rather than hidden behind an edited file.
--
-- WHAT WAS MISSING AND WHY IT MATTERS.
--
-- The attempted quote text. When a quote failed the exact-match check, the code
-- nulled it before the store ever saw it. So the log said a quote failed and
-- never what it said. That leaves the single most important question about this
-- pipeline unanswerable: was it a NEAR MISS, where the model tidied a comma and
-- the matcher is too strict, or a FABRICATION, where nothing like it is on the
-- page and retrieval is broken? Those have opposite fixes. Loosening the
-- matcher when the truth is fabrication would publish invented quotes.
--
-- A denominator. A claim that died early left no row at all, so "two premises
-- sourced" meant one thing out of two claims and something very different out
-- of five, with no way to tell which. mini_claims records every claim the
-- outline produced, researched or not, with what became of it.
--
-- The search queries. What was actually typed into the search was discarded.
-- When a claim finds nothing, that is the first thing worth reading.
--
-- The fetch ledger. Failed fetches were swallowed into null. So "the briefing
-- is thin" could mean the search found nothing, the pages would not load, or
-- the pages loaded and said nothing useful. Three problems, three fixes, and
-- they looked identical.
--
-- The inputs. Kept so a run can be REPLAYED offline through the real pipeline
-- with no network and no cost. That is what turns this log from a record into
-- a test set, and it is the only honest way to ask whether a change helped.

-- The claim ledger. One row per claim the outline produced.
CREATE TABLE IF NOT EXISTS mini_claims (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  briefing_id  TEXT    NOT NULL REFERENCES mini_briefings(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,          -- order in the article
  claim        TEXT    NOT NULL,
  load         TEXT,                      -- what fails if the claim is false
  researched   INTEGER NOT NULL,          -- 0 when the claim budget never reached it
  sourced      INTEGER NOT NULL,          -- 0 when nothing survived both gates
  outcome      TEXT    NOT NULL,          -- plain reason: 'sourced', 'search returned nothing', ...
  queries      TEXT                       -- JSON array of what was actually searched
);
CREATE INDEX IF NOT EXISTS idx_miclaim_briefing ON mini_claims (briefing_id);
CREATE INDEX IF NOT EXISTS idx_miclaim_outcome  ON mini_claims (outcome);

-- The fetch ledger. One row per page the pipeline tried to read.
CREATE TABLE IF NOT EXISTS mini_fetches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  briefing_id  TEXT    NOT NULL REFERENCES mini_briefings(id) ON DELETE CASCADE,
  url          TEXT    NOT NULL,
  resolved_url TEXT,
  domain       TEXT,
  ms           INTEGER,
  status       INTEGER,
  outcome      TEXT    NOT NULL,          -- 'ok' | 'http_error' | 'too_short' | 'unreachable'
  chars        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_mifetch_briefing ON mini_fetches (briefing_id);
CREATE INDEX IF NOT EXISTS idx_mifetch_domain   ON mini_fetches (domain, outcome);

-- The inputs, for replay. Separate table so the main one stays light: every
-- trend query reads mini_briefings, and none of them want 70KB of article text
-- dragged along for the ride.
CREATE TABLE IF NOT EXISTS mini_replay (
  briefing_id  TEXT PRIMARY KEY REFERENCES mini_briefings(id) ON DELETE CASCADE,
  article_text TEXT NOT NULL,
  pages        TEXT NOT NULL,             -- JSON: [{url, title, text}]
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- What the model claimed the quote said, kept even when the quote itself is
-- nulled so it can never reach a reader. Display safety is unchanged; only the
-- record is richer.
ALTER TABLE mini_sources ADD COLUMN attempted_quote TEXT;

-- Which stage was wrong, not just that something was.
--
-- "Wrong" does not say whether the outline picked bad claims, retrieval found
-- nothing, the quote gate leaked a paraphrase, or the relevance gate passed a
-- mismatch. Those are four different fixes, and in November nobody will
-- remember which one run 7 was.
ALTER TABLE mini_briefings ADD COLUMN verdict_stage TEXT;
