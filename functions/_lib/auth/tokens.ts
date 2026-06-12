export function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cryptographically-secure 6-digit numeric code, zero-padded.
 * Range 000000-999999 (1M combinations). Always paired with a rate-limiter
 * because brute-force is feasible without one.
 */
export function generateSixDigitCode(): string {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  const n = buf[0]! % 1_000_000;
  return n.toString().padStart(6, '0');
}
