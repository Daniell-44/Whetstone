import type { AuditResult } from '../audit/types';

// ---------------------------------------------------------------------------
// Shareable audit permalinks. Stored in KV with 30-day TTL.
//
// Key: "audit:<shortId>"
// Value: { audit, draftTitle?, draftSnippet, savedAt }
//
// draftSnippet is the first 200 chars of the original text — used as the OG
// description and as a "shared passage" preview on the audit-view page. We
// deliberately do not store the full draft to keep payload small and reduce
// privacy exposure for users sharing audits of pasted text.
// ---------------------------------------------------------------------------

export const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const KEY_PREFIX   = 'audit:';
const SHORT_ID_LEN = 12;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateShortId(): string {
  const bytes = new Uint8Array(SHORT_ID_LEN);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < SHORT_ID_LEN; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export interface StoredAuditLink {
  audit:        AuditResult;
  draftTitle:   string | null;
  draftSnippet: string;
  savedAt:      number;
}

export async function saveAuditLink(
  kv: KVNamespace,
  payload: { audit: AuditResult; draftTitle?: string; draftText: string },
): Promise<string> {
  const id = generateShortId();
  const stored: StoredAuditLink = {
    audit:        payload.audit,
    draftTitle:   payload.draftTitle ?? null,
    draftSnippet: payload.draftText.slice(0, 200),
    savedAt:      Date.now(),
  };
  await kv.put(`${KEY_PREFIX}${id}`, JSON.stringify(stored), { expirationTtl: TTL_SECONDS });
  return id;
}

export async function deleteAuditLink(kv: KVNamespace, id: string): Promise<void> {
  if (!/^[A-Za-z0-9]{12}$/.test(id)) return;
  await kv.delete(`${KEY_PREFIX}${id}`);
}

export async function getAuditLink(kv: KVNamespace, id: string): Promise<StoredAuditLink | null> {
  // Validate id format to prevent KV prefix scans
  if (!/^[A-Za-z0-9]{12}$/.test(id)) return null;
  const raw = await kv.get(`${KEY_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuditLink;
  } catch {
    return null;
  }
}
