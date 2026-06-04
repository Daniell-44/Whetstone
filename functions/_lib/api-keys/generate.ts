// Key format: wsk_live_<40 hex chars>  (total ~52 chars, unambiguous prefix for display)
const KEY_PREFIX_DISPLAY = 12; // chars shown in the UI after generation

export function generateKeyPlaintext(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `wsk_live_${hex}`;
}

export async function hashKey(plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext);
  const buffer  = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function keyDisplayPrefix(plaintext: string): string {
  return plaintext.slice(0, KEY_PREFIX_DISPLAY);
}
