export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../../functions/_lib/billing/subscription';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { handlePortalRequest } from '../../../../functions/_lib/billing/portal-handler';
import { createBillingPortalSession } from '../../../../functions/_lib/billing/stripe-client';

export const POST: APIRoute = async ({ request }) => {
  const authDb    = makeAuthDb(env.DB);
  const billingDb = makeBillingDb(env.DB);

  return handlePortalRequest(request, {
    db:                         billingDb,
    stripeApiKey:               env.STRIPE_SECRET_KEY,
    siteUrl:                    env.SITE_URL ?? '',
    getSession:                 (req) => getSessionFromRequest(req, authDb).then(s => s ? { userId: s.user_id } : null),
    createBillingPortalSession,
  });
};
