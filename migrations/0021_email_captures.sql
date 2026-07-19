-- Email capture list (new-briefing updates + extension launch notice).
-- Self-contained on D1: no email provider is wired yet, so the list just
-- accumulates here and a sender gets attached later.
-- UNIQUE(email, source) pairs with INSERT OR IGNORE in the handler so a
-- repeat submission is a silent success: the endpoint never reveals whether
-- an address is already on the list.
CREATE TABLE email_captures (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  source     TEXT NOT NULL CHECK(source IN ('briefing','extension','footer')),
  created_at INTEGER NOT NULL,
  UNIQUE(email, source)
);
CREATE INDEX idx_email_captures_created ON email_captures(created_at DESC);
