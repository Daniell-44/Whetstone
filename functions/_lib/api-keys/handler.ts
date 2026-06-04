import { z } from 'zod';
import type { ApiKeyDb } from './types';
import { generateKeyPlaintext, hashKey, keyDisplayPrefix } from './generate';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// GET /api/keys — list all keys for the authenticated user
// ---------------------------------------------------------------------------

export async function handleListKeys(userId: string, db: ApiKeyDb): Promise<Response> {
  const rows = await db.listForUser(userId);
  const keys = rows.map((r) => ({
    id:          r.id,
    name:        r.name,
    keyPrefix:   r.key_prefix,
    createdAt:   r.created_at,
    lastUsedAt:  r.last_used_at,
    revokedAt:   r.revoked_at,
  }));
  return json({ ok: true, keys });
}

// ---------------------------------------------------------------------------
// POST /api/keys — create a new key; returns plaintext once
// ---------------------------------------------------------------------------

const CreateSchema = z.object({ name: z.string().min(1).max(80) });

export async function handleCreateKey(
  request: Request,
  userId:  string,
  db:      ApiKeyDb,
): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0]?.message }, 400);

  // Enforce per-user key limit (max 10 active keys).
  const existing = await db.listForUser(userId);
  const active   = existing.filter((k) => k.revoked_at === null);
  if (active.length >= 10) {
    return json({ ok: false, error: 'Maximum of 10 active API keys reached. Revoke one first.' }, 409);
  }

  const plaintext = generateKeyPlaintext();
  const hash      = await hashKey(plaintext);
  const id        = crypto.randomUUID();

  await db.createKey({
    id,
    user_id:      userId,
    name:         parsed.data.name,
    key_prefix:   keyDisplayPrefix(plaintext),
    key_hash:     hash,
    created_at:   Date.now(),
    last_used_at: null,
    revoked_at:   null,
  });

  return json({
    ok:  true,
    key: {
      id,
      name:      parsed.data.name,
      plaintext, // returned once — never stored
      keyPrefix: keyDisplayPrefix(plaintext),
      createdAt: Date.now(),
    },
  }, 201);
}

// ---------------------------------------------------------------------------
// DELETE /api/keys/[keyId] — revoke a key
// ---------------------------------------------------------------------------

export async function handleRevokeKey(
  keyId:  string,
  userId: string,
  db:     ApiKeyDb,
): Promise<Response> {
  await db.revokeKey(keyId, userId);
  return json({ ok: true });
}
