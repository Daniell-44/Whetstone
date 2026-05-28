import { describe, it, expect } from 'vitest';
import { verifyStripeSignature } from '../../functions/_lib/billing/webhook-verify';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const SECRET = 'whsec_test_secret_key';
const BODY   = JSON.stringify({ type: 'customer.subscription.created', data: { object: { id: 'sub_1' } } });

async function sign(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeHeader(timestamp: number, sig: string): string {
  return `t=${timestamp},v1=${sig}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyStripeSignature', () => {
  it('accepts a valid signature and returns the parsed event', async () => {
    const ts  = Math.floor(Date.now() / 1000);
    const sig = await sign(SECRET, ts, BODY);
    const hdr = makeHeader(ts, sig);

    const result = await verifyStripeSignature(BODY, hdr, SECRET) as { type: string };
    expect(result.type).toBe('customer.subscription.created');
  });

  it('rejects a tampered body', async () => {
    const ts       = Math.floor(Date.now() / 1000);
    const sig      = await sign(SECRET, ts, BODY);
    const hdr      = makeHeader(ts, sig);
    const tampered = BODY.replace('created', 'deleted');

    await expect(verifyStripeSignature(tampered, hdr, SECRET))
      .rejects.toThrow(/verification failed/);
  });

  it('rejects a wrong signing secret', async () => {
    const ts  = Math.floor(Date.now() / 1000);
    const sig = await sign('wrong_secret', ts, BODY);
    const hdr = makeHeader(ts, sig);

    await expect(verifyStripeSignature(BODY, hdr, SECRET))
      .rejects.toThrow(/verification failed/);
  });

  it('rejects a timestamp older than 5 minutes', async () => {
    const stale = Math.floor(Date.now() / 1000) - 301;
    const sig   = await sign(SECRET, stale, BODY);
    const hdr   = makeHeader(stale, sig);

    await expect(verifyStripeSignature(BODY, hdr, SECRET))
      .rejects.toThrow(/too old/);
  });

  it('rejects a header missing the t field', async () => {
    const ts  = Math.floor(Date.now() / 1000);
    const sig = await sign(SECRET, ts, BODY);

    await expect(verifyStripeSignature(BODY, `v1=${sig}`, SECRET))
      .rejects.toThrow(/missing required fields/);
  });

  it('rejects a header missing the v1 field', async () => {
    const ts = Math.floor(Date.now() / 1000);
    await expect(verifyStripeSignature(BODY, `t=${ts}`, SECRET))
      .rejects.toThrow(/missing required fields/);
  });

  it('accepts a timestamp exactly at the 5-minute boundary (300s old)', async () => {
    const ts  = Math.floor(Date.now() / 1000) - 300;
    const sig = await sign(SECRET, ts, BODY);
    const hdr = makeHeader(ts, sig);

    // 300s is within the window — should succeed
    await expect(verifyStripeSignature(BODY, hdr, SECRET)).resolves.toBeDefined();
  });
});
