import type { BillingDb } from './types';

export interface PortalHandlerDeps {
  db:         BillingDb;
  stripeApiKey: string | undefined;
  siteUrl:    string;
  getSession: (req: Request) => Promise<{ userId: string } | null>;
  createBillingPortalSession: (
    apiKey: string,
    params: { customerId: string; returnUrl: string },
  ) => Promise<{ url: string }>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handlePortalRequest(
  request: Request,
  deps:    PortalHandlerDeps,
): Promise<Response> {
  const session = await deps.getSession(request);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to access billing' } }, 401);
  }

  if (!deps.stripeApiKey) {
    return json({ ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Billing not configured' } }, 503);
  }

  const user = await deps.db.getUserWithSubscription(session.userId);
  if (!user?.stripe_customer_id) {
    return json({
      ok:    false,
      error: { code: 'NO_SUBSCRIPTION', message: 'No Stripe customer found — subscribe first.' },
    }, 400);
  }

  const portalSession = await deps.createBillingPortalSession(deps.stripeApiKey, {
    customerId: user.stripe_customer_id,
    returnUrl:  `${deps.siteUrl}/account`,
  });

  return json({ ok: true, url: portalSession.url });
}
