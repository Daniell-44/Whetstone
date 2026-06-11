-- Adds a 6-digit code path to magic_links so users who click the email link
-- on a different device than they requested it from can finish sign-in by
-- typing the code into the requesting device.
--
-- code_hash:    SHA-256 hash of the 6-digit code (never store plaintext)
-- code_attempts: incremented on every wrong attempt; locks out at 5
--
-- Apply to BOTH databases:
--   npx wrangler d1 execute whetstone-users         --file=migrations/0017_magic_link_code.sql --remote
--   npx wrangler d1 execute whetstone-users-preview --file=migrations/0017_magic_link_code.sql --remote

ALTER TABLE magic_links ADD COLUMN code_hash      TEXT;
ALTER TABLE magic_links ADD COLUMN code_attempts  INTEGER DEFAULT 0;
