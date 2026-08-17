-- Publishing a reader's question as a page on the site.
--
-- Daniel, 2026-08-17: "you can make these into user generated briefings which
-- can sit in the home page with a tag saying so. these wont have opinion
-- pieces attatched to the end of them."
--
-- No new table. A published reader question IS a stored mini-briefing run,
-- and copying it into a second table would immediately raise the question of
-- which copy is true when the payload and the page disagree. Publication is
-- three columns on the run itself, so the page and the record cannot drift.
--
-- published defaults to 0: nothing publishes itself. See publish.ts for why
-- the owner presses the button rather than a threshold doing it silently.
--
-- The slug is kept when a page is unpublished (the UPDATE clears `published`
-- and leaves `slug` alone), so an address that was once public can never be
-- handed to a different run later.

ALTER TABLE mini_briefings ADD COLUMN published    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mini_briefings ADD COLUMN slug         TEXT;
ALTER TABLE mini_briefings ADD COLUMN published_at TEXT;

-- One address, one run, enforced by the database rather than by the code that
-- happens to mint slugs today.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_slug ON mini_briefings (slug) WHERE slug IS NOT NULL;

-- The home-page shelf and the index page both read newest-published-first.
CREATE INDEX IF NOT EXISTS idx_mini_published ON mini_briefings (published, published_at DESC) WHERE published = 1;
