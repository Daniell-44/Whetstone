import type { BillingDb, StripeSubscription } from './types';
import { upsertSubscriptionFromStripe } from './subscription';

export interface WebhookHandlerDeps {
  db:                   BillingDb;
  stripeApiKey:         string | undefined;
  webhookSecret:        string | undefined;
  verifySignature:      (rawBody: string, sigHeader: string, secret: string) => Promise<unknown>;
  retrieveSubscription: (apiKey: string, subscriptionId: string) => Promise<StripeSubscription>;
}

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

async function processEvent(event: StripeEvent, deps: WebhookHandlerDeps): Promise<void> {
  const obj = event.data.object;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub  = obj as unknown as StripeSubscription;
      const user = await deps.db.findUserByStripeCustomerId(sub.customer);
      if (!user) {
        console.warn(`[webhook] no user found for Stripe customer ${sub.customer}`);
        return;
      }
      await upsertSubscriptionFromStripe(deps.db, user.id, sub);
      break;
    }

    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed': {
      // Invoice object has a subscription field with the subscription ID.
      const subscriptionId = obj['subscription'] as string | undefined;
      if (!subscriptionId || !deps.stripeApiKey) return;
      const sub  = await deps.retrieveSubscription(deps.stripeApiKey, subscriptionId);
      const user = await deps.db.findUserByStripeCustomerId(sub.customer);
      if (!user) {
        console.warn(`[webhook] no user found for Stripe customer ${sub.customer}`);
        return;
      }
      await upsertSubscriptionFromStripe(deps.db, user.id, sub);
      break;
    }

    default:
      // Silently ignore unrecognised event types.
      break;
  }
}

export async function handleWebhookRequest(
  request: Request,
  deps:    WebhookHandlerDeps,
): Promise<Response> {
  if (!deps.webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const rawBody   = await request.text();
  const sigHeader = request.headers.get('Stripe-Signature') ?? '';

  let event: StripeEvent;
  try {
    event = (await deps.verifySignature(rawBody, sigHeader, deps.webhookSecret)) as StripeEvent;
  } catch (err) {
    console.error('[webhook] signature verification failed:', err instanceof Error ? err.message : err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Process asynchronously but always return 200 — Stripe retries on non-2xx
  // and that compounds problems. Log processing failures instead.
  try {
    await processEvent(event, deps);
  } catch (err) {
    console.error('[webhook] processing error for', event.type, ':', err instanceof Error ? err.message : err);
  }

  return new Response('ok', { status: 200 });
}
