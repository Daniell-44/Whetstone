import type { StripeSubscription } from './types';

const STRIPE_BASE = 'https://api.stripe.com';

type FetchFn = typeof fetch;

// Recursively flatten a nested object into Stripe's bracket-notation form encoding.
// { line_items: [{ price: 'p', quantity: 1 }] }
// → "line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1"
function buildFormParts(data: Record<string, unknown>, prefix = ''): string[] {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (val === null || val === undefined) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const item = val[i];
        if (item !== null && typeof item === 'object') {
          parts.push(...buildFormParts(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      }
    } else if (typeof val === 'object') {
      parts.push(...buildFormParts(val as Record<string, unknown>, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts;
}

async function stripePost(
  apiKey:  string,
  path:    string,
  data:    Record<string, unknown>,
  _fetch:  FetchFn = fetch,
): Promise<unknown> {
  const res = await _fetch(`${STRIPE_BASE}${path}`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildFormParts(data).join('&'),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function stripeGet(
  apiKey: string,
  path:   string,
  _fetch: FetchFn = fetch,
): Promise<unknown> {
  const res = await _fetch(`${STRIPE_BASE}${path}`, {
    method:  'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function createCustomer(
  apiKey:  string,
  params:  { email: string; metadata: Record<string, string> },
  _fetch?: FetchFn,
): Promise<{ id: string }> {
  return stripePost(apiKey, '/v1/customers', params, _fetch) as Promise<{ id: string }>;
}

export async function createCheckoutSession(
  apiKey:  string,
  params:  {
    customerId:  string;
    priceId:     string;
    successUrl:  string;
    cancelUrl:   string;
    mode:        'subscription';
  },
  _fetch?: FetchFn,
): Promise<{ url: string }> {
  return stripePost(apiKey, '/v1/checkout/sessions', {
    customer:    params.customerId,
    mode:        params.mode,
    success_url: params.successUrl,
    cancel_url:  params.cancelUrl,
    line_items:  [{ price: params.priceId, quantity: 1 }],
  }, _fetch) as Promise<{ url: string }>;
}

export async function createBillingPortalSession(
  apiKey:  string,
  params:  { customerId: string; returnUrl: string },
  _fetch?: FetchFn,
): Promise<{ url: string }> {
  return stripePost(apiKey, '/v1/billing_portal/sessions', {
    customer:   params.customerId,
    return_url: params.returnUrl,
  }, _fetch) as Promise<{ url: string }>;
}

export async function retrieveSubscription(
  apiKey:         string,
  subscriptionId: string,
  _fetch?:        FetchFn,
): Promise<StripeSubscription> {
  return stripeGet(apiKey, `/v1/subscriptions/${subscriptionId}`, _fetch) as Promise<StripeSubscription>;
}
