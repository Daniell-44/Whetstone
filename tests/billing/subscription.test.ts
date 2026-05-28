import { describe, it, expect } from 'vitest';
import { userHasActiveSubscription, getUserSubscription } from '../../functions/_lib/billing/subscription';
import type { BillingDb, DbUserWithSubscription } from '../../functions/_lib/billing/types';

// ---------------------------------------------------------------------------
// Fake BillingDb
// ---------------------------------------------------------------------------

function makeFakeDb(row: Partial<DbUserWithSubscription> | null): BillingDb {
  const user: DbUserWithSubscription | null = row
    ? {
        id:                              row.id                              ?? 'user-1',
        email:                           row.email                           ?? 'test@example.com',
        stripe_customer_id:              row.stripe_customer_id              ?? null,
        stripe_subscription_id:          row.stripe_subscription_id          ?? null,
        subscription_status:             row.subscription_status             ?? null,
        subscription_current_period_end: row.subscription_current_period_end ?? null,
        subscription_updated_at:         row.subscription_updated_at         ?? null,
      }
    : null;

  return {
    getUserWithSubscription: async () => user,
    updateStripeCustomerId:  async () => {},
    upsertSubscription:      async () => {},
    findUserByStripeCustomerId: async () => null,
  };
}

const FUTURE_MS = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now
const PAST_MS   = Date.now() - 1;                         // 1ms ago

// ---------------------------------------------------------------------------
// userHasActiveSubscription
// ---------------------------------------------------------------------------

describe('userHasActiveSubscription', () => {
  it('returns true for status=active with a future period end', async () => {
    const db = makeFakeDb({ subscription_status: 'active', subscription_current_period_end: FUTURE_MS });
    expect(await userHasActiveSubscription(db, 'user-1')).toBe(true);
  });

  it('returns true for status=trialing with a future period end', async () => {
    const db = makeFakeDb({ subscription_status: 'trialing', subscription_current_period_end: FUTURE_MS });
    expect(await userHasActiveSubscription(db, 'user-1')).toBe(true);
  });

  it('returns false for status=active with an expired period end', async () => {
    const db = makeFakeDb({ subscription_status: 'active', subscription_current_period_end: PAST_MS });
    expect(await userHasActiveSubscription(db, 'user-1')).toBe(false);
  });

  it('returns false for status=canceled', async () => {
    const db = makeFakeDb({ subscription_status: 'canceled', subscription_current_period_end: FUTURE_MS });
    expect(await userHasActiveSubscription(db, 'user-1')).toBe(false);
  });

  it('returns false for status=past_due', async () => {
    const db = makeFakeDb({ subscription_status: 'past_due', subscription_current_period_end: FUTURE_MS });
    expect(await userHasActiveSubscription(db, 'user-1')).toBe(false);
  });

  it('returns false when subscription_status is null (never subscribed)', async () => {
    const db = makeFakeDb({ subscription_status: null });
    expect(await userHasActiveSubscription(db, 'user-1')).toBe(false);
  });

  it('returns false when user record is null', async () => {
    const db = makeFakeDb(null);
    expect(await userHasActiveSubscription(db, 'unknown-user')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUserSubscription
// ---------------------------------------------------------------------------

describe('getUserSubscription', () => {
  it('returns null when user has no subscription status', async () => {
    const db = makeFakeDb({ subscription_status: null });
    expect(await getUserSubscription(db, 'user-1')).toBeNull();
  });

  it('returns subscription fields when status is present', async () => {
    const db = makeFakeDb({
      subscription_status:             'active',
      subscription_current_period_end: FUTURE_MS,
      stripe_subscription_id:          'sub_abc',
      stripe_customer_id:              'cus_xyz',
    });
    const result = await getUserSubscription(db, 'user-1');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('active');
    expect(result?.currentPeriodEnd).toBe(FUTURE_MS);
    expect(result?.stripeSubscriptionId).toBe('sub_abc');
    expect(result?.stripeCustomerId).toBe('cus_xyz');
  });
});
