export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../../functions/_lib/billing/subscription';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { handleCheckoutRequest } from '../../../../functions/_lib/billing/checkout-handler';
import { createCustomer, createCheckoutSession } from '../../../../functions/_lib/billing/stripe-client';

export const POST: APIRoute = async ({ request }) => {
  const authDb    = makeAuthDb(env.DB);
  const billingDb = makeBillingDb(env.DB);

  return handleCheckoutRequest(request, {
    db:                   billingDb,
    stripeApiKey:         env.STRIPE_SECRET_KEY,
    stripePriceId:        env.STRIPE_PRICE_ID,
    siteUrl:              env.SITE_URL ?? '',
    getSession:           (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    createCustomer,
    createCheckoutSession,
  });
};
