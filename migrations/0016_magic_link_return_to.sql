-- Adds a return_to column to magic_links so the verify endpoint can send the
-- user back to where they started the sign-in (e.g. /pricing, /creator/studio)
-- instead of defaulting to /account every time.
--
-- The column is nullable so existing pending magic links continue to work.
--
-- Apply to BOTH databases:
--   npx wrangler d1 execute whetstone-users         --file=migrations/0016_magic_link_return_to.sql --remote
--   npx wrangler d1 execute whetstone-users-preview --file=migrations/0016_magic_link_return_to.sql --remote

ALTER TABLE magic_links ADD COLUMN return_to TEXT;
