-- Adds Stripe subscription state to the users table.
-- One subscription per user max for v1; columns are nullable (null = never subscribed).
--
-- Apply to BOTH databases after deploying:
--   npx wrangler d1 execute whetstone-users         --file=migrations/0002_subscriptions.sql --remote
--   npx wrangler d1 execute whetstone-users-preview --file=migrations/0002_subscriptions.sql --remote

ALTER TABLE users ADD COLUMN stripe_customer_id          TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id      TEXT;
ALTER TABLE users ADD COLUMN subscription_status         TEXT;
-- epoch milliseconds; Stripe gives seconds so multiply by 1000 when storing
ALTER TABLE users ADD COLUMN subscription_current_period_end INTEGER;
-- epoch ms; when we last synced from Stripe
ALTER TABLE users ADD COLUMN subscription_updated_at     INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
