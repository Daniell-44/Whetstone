import type { BillingDb, DbUserWithSubscription, StripeSubscription } from './types';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export async function userHasActiveSubscription(db: BillingDb, userId: string): Promise<boolean> {
  const user = await db.getUserWithSubscription(userId);
  if (!user) return false;
  const { subscription_status, subscription_current_period_end } = user;
  if (!subscription_status || !ACTIVE_STATUSES.has(subscription_status)) return false;
  if (!subscription_current_period_end) return false;
  return subscription_current_period_end > Date.now();
}

export async function getUserSubscription(db: BillingDb, userId: string): Promise<{
  status:               string;
  currentPeriodEnd:     number | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId:     string | null;
} | null> {
  const user = await db.getUserWithSubscription(userId);
  if (!user || !user.subscription_status) return null;
  return {
    status:               user.subscription_status,
    currentPeriodEnd:     user.subscription_current_period_end,
    stripeSubscriptionId: user.stripe_subscription_id,
    stripeCustomerId:     user.stripe_customer_id,
  };
}

export async function upsertSubscriptionFromStripe(
  db:                 BillingDb,
  userId:             string,
  stripeSubscription: StripeSubscription,
): Promise<void> {
  await db.upsertSubscription(userId, {
    stripeSubscriptionId: stripeSubscription.id,
    status:               stripeSubscription.status,
    currentPeriodEnd:     stripeSubscription.current_period_end * 1000, // seconds → ms
  });
}

export function makeBillingDb(d1: D1Database): BillingDb {
  return {
    getUserWithSubscription: (userId) =>
      d1
        .prepare(
          `SELECT id, email, stripe_customer_id, stripe_subscription_id,
                  subscription_status, subscription_current_period_end, subscription_updated_at
           FROM users WHERE id = ?`,
        )
        .bind(userId)
        .first<DbUserWithSubscription>(),

    updateStripeCustomerId: async (userId, customerId) => {
      await d1
        .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?')
        .bind(customerId, userId)
        .run();
    },

    upsertSubscription: async (userId, data) => {
      const now = Date.now();
      await d1
        .prepare(
          `UPDATE users
           SET stripe_subscription_id      = ?,
               subscription_status         = ?,
               subscription_current_period_end = ?,
               subscription_updated_at     = ?
           WHERE id = ?`,
        )
        .bind(data.stripeSubscriptionId, data.status, data.currentPeriodEnd, now, userId)
        .run();
    },

    findUserByStripeCustomerId: (customerId) =>
      d1
        .prepare('SELECT id, email FROM users WHERE stripe_customer_id = ?')
        .bind(customerId)
        .first<{ id: string; email: string }>(),
  };
}
