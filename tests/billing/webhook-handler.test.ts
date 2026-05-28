import { describe, it, expect } from 'vitest';
import { handleWebhookRequest } from '../../functions/_lib/billing/webhook-handler';
import type { WebhookHandlerDeps } from '../../functions/_lib/billing/webhook-handler';
import type { BillingDb, DbUserWithSubscription, StripeSubscription } from '../../functions/_lib/billing/types';

// ---------------------------------------------------------------------------
// Fake BillingDb that records upsert calls
// ---------------------------------------------------------------------------

class FakeBillingDb implements BillingDb {
  upserts: Array<{ userId: string; data: { stripeSubscriptionId: string; status: string; currentPeriodEnd: number } }> = [];
  users   = new Map<string, { id: string; email: string }>();

  addUser(customerId: string, userId: string, email: string) {
    this.users.set(customerId, { id: userId, email });
  }

  async getUserWithSubscription(): Promise<DbUserWithSubscription | null> { return null; }
  async updateStripeCustomerId(): Promise<void> {}
  async upsertSubscription(userId: string, data: { stripeSubscriptionId: string; status: string; currentPeriodEnd: number }): Promise<void> {
    this.upserts.push({ userId, data });
  }
  async findUserByStripeCustomerId(customerId: string): Promise<{ id: string; email: string } | null> {
    return this.users.get(customerId) ?? null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_SUB: StripeSubscription = {
  id:                 'sub_test',
  status:             'active',
  customer:           'cus_test',
  current_period_end: 1_800_000_000,
};

function makeRequest(body: unknown, sigHeader = 'valid-sig'): Request {
  return new Request('https://test.example/api/billing/webhook', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sigHeader },
    body:    JSON.stringify(body),
  });
}

function makeDeps(db: FakeBillingDb, overrides?: Partial<WebhookHandlerDeps>): WebhookHandlerDeps {
  return {
    db,
    stripeApiKey:         'sk_test_key',
    webhookSecret:        'whsec_test',
    verifySignature:      async (rawBody) => JSON.parse(rawBody) as unknown,
    retrieveSubscription: async () => FAKE_SUB,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('POST /api/billing/webhook — signature', () => {
  it('returns 400 when signature verification throws', async () => {
    const db   = new FakeBillingDb();
    const deps = makeDeps(db, {
      verifySignature: async () => { throw new Error('bad sig'); },
    });
    const req = makeRequest({ type: 'customer.subscription.created', data: { object: FAKE_SUB } });
    const res = await handleWebhookRequest(req, deps);
    expect(res.status).toBe(400);
  });

  it('returns 500 when webhookSecret is not configured', async () => {
    const db   = new FakeBillingDb();
    const deps = makeDeps(db, { webhookSecret: undefined });
    const req  = makeRequest({ type: 'ping' });
    const res  = await handleWebhookRequest(req, deps);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// customer.subscription.* events
// ---------------------------------------------------------------------------

describe('POST /api/billing/webhook — subscription events', () => {
  for (const eventType of ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'] as const) {
    it(`upserts subscription on ${eventType}`, async () => {
      const db = new FakeBillingDb();
      db.addUser('cus_test', 'user-123', 'test@example.com');
      const deps = makeDeps(db);
      const req  = makeRequest({ type: eventType, data: { object: FAKE_SUB } });
      const res  = await handleWebhookRequest(req, deps);

      expect(res.status).toBe(200);
      expect(db.upserts).toHaveLength(1);
      expect(db.upserts[0]?.userId).toBe('user-123');
      expect(db.upserts[0]?.data.status).toBe('active');
      expect(db.upserts[0]?.data.stripeSubscriptionId).toBe('sub_test');
      // period end should be seconds * 1000
      expect(db.upserts[0]?.data.currentPeriodEnd).toBe(1_800_000_000 * 1000);
    });
  }

  it('logs and continues when no user found for customer ID', async () => {
    const db   = new FakeBillingDb(); // no users registered
    const deps = makeDeps(db);
    const req  = makeRequest({ type: 'customer.subscription.created', data: { object: FAKE_SUB } });
    const res  = await handleWebhookRequest(req, deps);

    expect(res.status).toBe(200);
    expect(db.upserts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// invoice.payment_* events
// ---------------------------------------------------------------------------

describe('POST /api/billing/webhook — invoice events', () => {
  for (const eventType of ['invoice.payment_succeeded', 'invoice.payment_failed'] as const) {
    it(`fetches subscription and upserts on ${eventType}`, async () => {
      const db = new FakeBillingDb();
      db.addUser('cus_test', 'user-456', 'test@example.com');
      const deps = makeDeps(db);
      const req  = makeRequest({ type: eventType, data: { object: { subscription: 'sub_test' } } });
      const res  = await handleWebhookRequest(req, deps);

      expect(res.status).toBe(200);
      expect(db.upserts).toHaveLength(1);
      expect(db.upserts[0]?.userId).toBe('user-456');
    });
  }
});

// ---------------------------------------------------------------------------
// Unknown event types
// ---------------------------------------------------------------------------

describe('POST /api/billing/webhook — unknown events', () => {
  it('returns 200 and does not touch the DB for unrecognised event types', async () => {
    const db   = new FakeBillingDb();
    const deps = makeDeps(db);
    const req  = makeRequest({ type: 'some.unknown.event', data: { object: {} } });
    const res  = await handleWebhookRequest(req, deps);

    expect(res.status).toBe(200);
    expect(db.upserts).toHaveLength(0);
  });

  it('still returns 200 even if processing throws internally', async () => {
    const db   = new FakeBillingDb();
    db.addUser('cus_test', 'user-789', 'x@y.com');
    const deps = makeDeps(db, {
      retrieveSubscription: async () => { throw new Error('Stripe API down'); },
    });
    const req = makeRequest({ type: 'invoice.payment_succeeded', data: { object: { subscription: 'sub_test' } } });
    const res = await handleWebhookRequest(req, deps);

    expect(res.status).toBe(200);
  });
});
