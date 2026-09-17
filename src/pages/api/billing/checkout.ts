export const prerender = false;

import type { APIRoute } from 'astro';

// ---------------------------------------------------------------------------
// Checkout is closed.
//
// Paid tiers were retired in 2026-09: every engine is free and the usage
// allowance is identical for everyone, so a subscription would buy nothing.
// This route refuses rather than being deleted, because a live Stripe endpoint
// that still takes money for a tier that grants nothing is worse than a 410 —
// and because the rest of the billing surface (webhook, portal, schema) is
// kept dormant so a future paid tier does not have to be rebuilt.
//
// To reopen: restore the handleCheckoutRequest wiring from git history and
// point /pricing back at a real page.
// ---------------------------------------------------------------------------

export const POST: APIRoute = async () =>
  new Response(
    JSON.stringify({
      ok:    false,
      error: {
        code:    'CHECKOUT_CLOSED',
        message: 'The Whetstone no longer sells subscriptions — every engine is free.',
      },
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  );
