export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeBillingDb } from '../../../../functions/_lib/billing/subscription';
import { handleWebhookRequest } from '../../../../functions/_lib/billing/webhook-handler';
import { verifyStripeSignature } from '../../../../functions/_lib/billing/webhook-verify';
import { retrieveSubscription } from '../../../../functions/_lib/billing/stripe-client';

export const POST: APIRoute = async ({ request }) => {
  const billingDb = makeBillingDb(env.DB);

  return handleWebhookRequest(request, {
    db:                   billingDb,
    stripeApiKey:         env.STRIPE_SECRET_KEY,
    webhookSecret:        env.STRIPE_WEBHOOK_SECRET,
    verifySignature:      verifyStripeSignature,
    retrieveSubscription,
  });
};
