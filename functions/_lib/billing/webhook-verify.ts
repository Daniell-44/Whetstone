const MAX_AGE_SECONDS = 300; // 5 minutes

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length');
  const buf   = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Parses the Stripe-Signature header, verifies HMAC-SHA256 using Web Crypto
// (constant-time via crypto.subtle.verify), and returns the parsed event payload.
// Throws on any failure: bad header, stale timestamp, or wrong signature.
export async function verifyStripeSignature(
  rawBody:         string,
  signatureHeader: string,
  signingSecret:   string,
): Promise<unknown> {
  // Parse "t=1629000000,v1=abcdef..."
  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(',')) {
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    parts[segment.slice(0, eq).trim()] = segment.slice(eq + 1).trim();
  }

  const timestamp = parts['t'];
  const v1        = parts['v1'];
  if (!timestamp || !v1) {
    throw new Error('Stripe-Signature header missing required fields (t, v1)');
  }

  const tsSecs  = parseInt(timestamp, 10);
  const nowSecs = Math.floor(Date.now() / 1000);
  if (isNaN(tsSecs) || Math.abs(nowSecs - tsSecs) > MAX_AGE_SECONDS) {
    throw new Error('Webhook timestamp is too old or too far in the future');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const payload        = new TextEncoder().encode(`${timestamp}.${rawBody}`);
  const signatureBytes = hexToBytes(v1);
  const isValid        = await crypto.subtle.verify('HMAC', key, signatureBytes, payload);

  if (!isValid) throw new Error('Stripe signature verification failed');

  return JSON.parse(rawBody);
}
