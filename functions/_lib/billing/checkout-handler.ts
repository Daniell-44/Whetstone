import type { BillingDb } from './types';

export interface CheckoutHandlerDeps {
  db:                   BillingDb;
  stripeApiKey:         string | undefined;
  stripePriceId:        string | undefined;
  siteUrl:              string;
  getSession:           (req: Request) => Promise<{ userId: string } | null>;
  createCustomer:       (
    apiKey: string,
    params: { email: string; metadata: Record<string, string> },
  ) => Promise<{ id: string }>;
  createCheckoutSession: (
    apiKey: string,
    params: {
      customerId:  string;
      priceId:     string;
      successUrl:  string;
      cancelUrl:   string;
      mode:        'subscription';
    },
  ) => Promise<{ url: string }>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleCheckoutRequest(
  request: Request,
  deps:    CheckoutHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(request);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to subscribe' } }, 401);
  }

  if (!deps.stripeApiKey || !deps.stripePriceId) {
    return json({ ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Billing not configured' } }, 503);
  }

  const user = await deps.db.getUserWithSubscription(session.userId);
  if (!user) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  try {
    // Get existing Stripe customer or create one now.
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await deps.createCustomer(deps.stripeApiKey, {
        email:    user.email,
        metadata: { user_id: session.userId },
      });
      customerId = customer.id;
      await deps.db.updateStripeCustomerId(session.userId, customerId);
    }

    const checkoutSession = await deps.createCheckoutSession(deps.stripeApiKey, {
      customerId,
      priceId:    deps.stripePriceId,
      successUrl: `${deps.siteUrl}/account?checkout=success`,
      cancelUrl:  `${deps.siteUrl}/pricing?checkout=canceled`,
      mode:       'subscription',
    });

    return json({ ok: true, url: checkoutSession.url });
  } catch (err) {
    // Surface the real Stripe error (e.g. "No such price" from a mode
    // mismatch) instead of an opaque 500.
    const message = err instanceof Error ? err.message : 'Checkout failed';
    console.error(`[checkout] Stripe error: ${message}`);
    return json({ ok: false, error: { code: 'STRIPE_ERROR', message } }, 502);
  }
}
