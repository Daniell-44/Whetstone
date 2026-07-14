// Studio pricing — ONE source of truth. Hardcoded price literals had drifted
// ($22/mo in the in-editor upsell + account page vs A$33/mo at the pricing page
// and Stripe checkout), so a click from an upsell met a ~50% higher number at
// the wall. Billing currency is AUD (decided; Stripe charges A$); the ~US$ note
// exists because most of the audience reads A$33 as ~US$33 rather than ~US$22.
//
// A Vitest guard (tests/pricing/consistency.test.ts) fails if a bare
// "$NN/mo" price literal appears in src/ outside this module.

export const STUDIO_SOLO = {
  amount: 33,
  currency: 'AUD',
  display: 'A$33',
  unit: '/mo',
  /** For non-AU readers: a static approximate USD (billing stays AUD). */
  approxUsd: 'US$22',
} as const;

export const STUDIO_TEAM = {
  amount: 95,
  currency: 'AUD',
  display: 'A$95',
  unit: '/mo',
  seats: 5,
} as const;

/** "A$33/mo" — the canonical inline price string. */
export const soloPrice = `${STUDIO_SOLO.display}${STUDIO_SOLO.unit}`;
/** "A$33/mo (~US$22)" — where audience currency confusion is likely (checkout, account). */
export const soloPriceWithUsd = `${soloPrice} (~${STUDIO_SOLO.approxUsd})`;
/** "A$95/mo" — the Team tier. */
export const teamPrice = `${STUDIO_TEAM.display}${STUDIO_TEAM.unit}`;
