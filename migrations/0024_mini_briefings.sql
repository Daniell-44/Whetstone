-- Every mini-briefing run, kept.
--
-- Daniel, 2026-08-13: "can you save the mini breifings made to a data base on
-- the site which i can access? and then maybe can even eval to see if there is
-- trends in output to improve".
--
-- TWO DESIGN DECISIONS THAT DECIDE WHETHER THIS IS USEFUL LATER.
--
-- 1. THE DROPS ARE THE DATA. Most systems store what survived. The signal for
--    improving this pipeline is what did NOT: a quote that failed the exact
--    match, a quote that was real but about a different quantity, a claim that
--    retrieved nothing. Those rows say where the pipeline is weak. Keeping only
--    the output would leave the question "why is this thin" permanently
--    unanswerable. So mini_sources holds every source considered, kept or not,
--    with the reason.
--
-- 2. VERSION EVERY RUN. Without knowing which pipeline produced a row, a change
--    in quality cannot be attributed: the prompt changed, the model drifted,
--    and the articles were different, all at once. pipeline_version is stamped
--    on every run so a before-and-after is a real comparison rather than a
--    vibe.
--
-- Privacy. url is stored only for signed-in runs, which today means the owner's
-- own. Anonymous runs keep url_hash alone, matching the placement cache, which
-- already stores a SHA-256 hex of the URL and never the address itself. That
-- rule has to hold before a second user exists, so it is enforced in code at
-- functions/_lib/premise/store.ts rather than left to whoever writes the next
-- caller.

CREATE TABLE IF NOT EXISTS mini_briefings (
  id                TEXT    PRIMARY KEY,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),

  -- who and how
  user_id           TEXT,                     -- NULL for anonymous runs
  trigger           TEXT    NOT NULL,         -- 'selection' | 'article'
  depth             TEXT    NOT NULL,         -- 'outline' | 'full'
  pipeline_version  TEXT    NOT NULL,
  model             TEXT    NOT NULL,

  -- what went in
  url               TEXT,                     -- signed-in runs only
  url_hash          TEXT    NOT NULL,
  title             TEXT,
  input_chars       INTEGER NOT NULL,

  -- what came out
  tier              TEXT    NOT NULL,         -- 'premises' | 'contrast' | 'single' | 'none' | 'outline'
  question          TEXT,
  conclusion        TEXT,
  claim_count       INTEGER NOT NULL DEFAULT 0,
  premise_count     INTEGER NOT NULL DEFAULT 0,
  payload           TEXT    NOT NULL,         -- full JSON, for fidelity and replay

  -- what it cost
  outline_ms        INTEGER,
  total_ms          INTEGER,
  calls             INTEGER NOT NULL DEFAULT 0,
  grounded_calls    INTEGER NOT NULL DEFAULT 0,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cost_usd          REAL    NOT NULL DEFAULT 0,

  -- what the gates threw away
  dropped_unverified INTEGER NOT NULL DEFAULT 0,
  dropped_off_claim  INTEGER NOT NULL DEFAULT 0,

  -- the owner's own mark. The only accuracy signal that will exist at one user,
  -- so it has somewhere to live from the first run rather than being retrofitted.
  verdict           TEXT,                     -- 'right' | 'wrong' | 'mixed'
  verdict_note      TEXT,
  verdict_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_mini_created  ON mini_briefings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mini_user     ON mini_briefings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mini_verdict  ON mini_briefings (verdict) WHERE verdict IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mini_version  ON mini_briefings (pipeline_version, created_at DESC);

-- One row per source CONSIDERED. Kept and dropped alike.
CREATE TABLE IF NOT EXISTS mini_sources (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  briefing_id       TEXT    NOT NULL REFERENCES mini_briefings(id) ON DELETE CASCADE,
  claim             TEXT    NOT NULL,
  who               TEXT,
  publication       TEXT,
  domain            TEXT,                     -- for asking which sources are worth fetching
  stance            TEXT,                     -- 'contests' | 'complicates' | 'supports'
  kept              INTEGER NOT NULL,         -- 1 or 0
  drop_stage        TEXT,                     -- 'quote' | 'relevance' | NULL when kept
  drop_reason       TEXT,
  quote_chars       INTEGER,
  url               TEXT
);

CREATE INDEX IF NOT EXISTS idx_misrc_briefing ON mini_sources (briefing_id);
CREATE INDEX IF NOT EXISTS idx_misrc_domain   ON mini_sources (domain, kept);
CREATE INDEX IF NOT EXISTS idx_misrc_drop     ON mini_sources (drop_stage) WHERE drop_stage IS NOT NULL;
