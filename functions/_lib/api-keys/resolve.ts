import type { ApiKeyDb } from './types';
import { hashKey } from './generate';

const BEARER_RE = /^Bearer\s+(wsk_live_[0-9a-f]{40})$/;

// Resolve the caller's identity from an Authorization: Bearer header.
// Returns the userId if the key is valid and active, null otherwise.
// Also updates last_used_at on success (fire-and-forget).
export async function resolveApiKeyIdentity(
  request:   Request,
  apiKeyDb:  ApiKeyDb,
): Promise<string | null> {
  const auth = request.headers.get('Authorization') ?? '';
  const match = BEARER_RE.exec(auth);
  if (!match) return null;

  const plaintext = match[1]!;
  const hash      = await hashKey(plaintext);
  const row       = await apiKeyDb.findByHash(hash);
  if (!row) return null;

  // Touch last_used_at — intentionally not awaited (best-effort).
  void apiKeyDb.touchLastUsed(row.id, Date.now());

  return row.user_id;
}
