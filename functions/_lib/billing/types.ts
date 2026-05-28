// User row joined with all subscription columns (nullable until first subscription).
export interface DbUserWithSubscription {
  id:                              string;
  email:                           string;
  stripe_customer_id:              string | null;
  stripe_subscription_id:          string | null;
  subscription_status:             string | null;
  subscription_current_period_end: number | null;
  subscription_updated_at:         number | null;
}

// Subset of a Stripe Subscription object we actually use.
export interface StripeSubscription {
  id:                 string;
  status:             string;
  customer:           string;
  current_period_end: number; // Unix timestamp in seconds — multiply by 1000 to get ms
}

// Narrow interface so billing helpers work against D1 in production
// and a Map-backed fake in tests.
export interface BillingDb {
  getUserWithSubscription(userId: string): Promise<DbUserWithSubscription | null>;
  updateStripeCustomerId(userId: string, customerId: string): Promise<void>;
  upsertSubscription(
    userId: string,
    data: { stripeSubscriptionId: string; status: string; currentPeriodEnd: number },
  ): Promise<void>;
  findUserByStripeCustomerId(customerId: string): Promise<{ id: string; email: string } | null>;
}
