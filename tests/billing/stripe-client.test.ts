import { describe, it, expect, vi } from 'vitest';
import {
  createCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  retrieveSubscription,
} from '../../functions/_lib/billing/stripe-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(body: unknown, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response);
}

function parseForm(body: string): Record<string, string> {
  return Object.fromEntries(
    body.split('&').map(part => {
      const eq = part.indexOf('=');
      return [decodeURIComponent(part.slice(0, eq)), decodeURIComponent(part.slice(eq + 1))];
    }),
  );
}

// ---------------------------------------------------------------------------
// createCustomer
// ---------------------------------------------------------------------------

describe('createCustomer', () => {
  it('POSTs to /v1/customers with auth header and form-encoded email + metadata', async () => {
    const mockFetch = makeFetch({ id: 'cus_test123' });
    const result = await createCustomer(
      'sk_test_key',
      { email: 'user@example.com', metadata: { user_id: 'u-abc' } },
      mockFetch,
    );

    expect(result).toEqual({ id: 'cus_test123' });

    const [url, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/customers');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk_test_key');

    const form = parseForm(init.body as string);
    expect(form['email']).toBe('user@example.com');
    expect(form['metadata[user_id]']).toBe('u-abc');
  });

  it('throws on non-2xx response', async () => {
    const mockFetch = makeFetch({ error: { message: 'Invalid API key' } }, 401);
    await expect(
      createCustomer('bad-key', { email: 'x@y.com', metadata: {} }, mockFetch),
    ).rejects.toThrow(/failed \(401\)/);
  });
});

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

describe('createCheckoutSession', () => {
  it('POSTs to /v1/checkout/sessions with correct line_items bracket notation', async () => {
    const mockFetch = makeFetch({ url: 'https://checkout.stripe.com/session_url' });
    const result = await createCheckoutSession(
      'sk_test_key',
      {
        customerId:  'cus_123',
        priceId:     'price_abc',
        successUrl:  'https://site.example/account?checkout=success',
        cancelUrl:   'https://site.example/pricing?checkout=canceled',
        mode:        'subscription',
      },
      mockFetch,
    );

    expect(result.url).toBe('https://checkout.stripe.com/session_url');

    const [url, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');

    const form = parseForm(init.body as string);
    expect(form['customer']).toBe('cus_123');
    expect(form['mode']).toBe('subscription');
    expect(form['success_url']).toBe('https://site.example/account?checkout=success');
    expect(form['cancel_url']).toBe('https://site.example/pricing?checkout=canceled');
    expect(form['line_items[0][price]']).toBe('price_abc');
    expect(form['line_items[0][quantity]']).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// createBillingPortalSession
// ---------------------------------------------------------------------------

describe('createBillingPortalSession', () => {
  it('POSTs to /v1/billing_portal/sessions with customer and return_url', async () => {
    const mockFetch = makeFetch({ url: 'https://billing.stripe.com/portal_url' });
    const result = await createBillingPortalSession(
      'sk_test_key',
      { customerId: 'cus_456', returnUrl: 'https://site.example/account' },
      mockFetch,
    );

    expect(result.url).toBe('https://billing.stripe.com/portal_url');

    const [url, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/billing_portal/sessions');

    const form = parseForm(init.body as string);
    expect(form['customer']).toBe('cus_456');
    expect(form['return_url']).toBe('https://site.example/account');
  });
});

// ---------------------------------------------------------------------------
// retrieveSubscription
// ---------------------------------------------------------------------------

describe('retrieveSubscription', () => {
  it('GETs /v1/subscriptions/:id with auth header', async () => {
    const subData = { id: 'sub_abc', status: 'active', customer: 'cus_123', current_period_end: 1_700_000_000 };
    const mockFetch = makeFetch(subData);
    const result = await retrieveSubscription('sk_test_key', 'sub_abc', mockFetch);

    expect(result).toEqual(subData);

    const [url, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/subscriptions/sub_abc');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk_test_key');
  });

  it('throws on non-2xx response', async () => {
    const mockFetch = makeFetch('Not found', 404);
    await expect(
      retrieveSubscription('sk_test_key', 'sub_missing', mockFetch),
    ).rejects.toThrow(/failed \(404\)/);
  });
});
