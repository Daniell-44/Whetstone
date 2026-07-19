export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { makeAuditLinkIndexDb } from '../../../functions/_lib/audit-links/index-db';
import { deleteAuditLink } from '../../../functions/_lib/audit-links/storage';

// ---------------------------------------------------------------------------
// Share-link lifecycle for signed-in users.
//
// GET  -> list the caller's own share links (from the D1 side-index; links
//         created before the index existed cannot be listed).
// POST -> { id, action: 'revoke' }: ownership-checked, deletes the KV payload
//         (the link stops resolving immediately) and hard-deletes the index
//         row - a revoked link's row has no purpose, and the title may be
//         user-authored, so nothing user-linked is retained.
// ---------------------------------------------------------------------------

const RevokeSchema = z.object({
  id:     z.string().regex(/^[A-Za-z0-9]{12}$/),
  action: z.literal('revoke'),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getAuthedUserId(request: Request): Promise<string | null> {
  const session = await getSessionFromRequest(request, makeAuthDb(env.DB));
  return session?.user_id ?? null;
}

export async function GET({ request }: APIContext) {
  const userId = await getAuthedUserId(request);
  if (!userId) return json({ ok: false, error: 'Unauthorised' }, 401);

  const rows = await makeAuditLinkIndexDb(env.DB).listForUser(userId, Date.now());
  return json({
    ok: true,
    shares: rows.map(r => ({
      id:        r.id,
      title:     r.title,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    })),
  });
}

export async function POST({ request }: APIContext) {
  const userId = await getAuthedUserId(request);
  if (!userId) return json({ ok: false, error: 'Unauthorised' }, 401);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const parsed = RevokeSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const indexDb = makeAuditLinkIndexDb(env.DB);
  const row = await indexDb.getById(parsed.data.id);
  // Same response for "not found" and "not yours": no existence leak.
  if (!row || row.user_id !== userId) {
    return json({ ok: false, error: 'Share link not found' }, 404);
  }

  // Delete the KV payload first (the link stops resolving), then remove the
  // index row entirely. KV may be unbound in local dev; the index delete
  // still runs so the list stays consistent. deleteRow is user_id-scoped, so
  // ownership is enforced at the db layer too, not just by the check above.
  if (env.AUDIT_LINKS) {
    await deleteAuditLink(env.AUDIT_LINKS, row.id);
  }
  await indexDb.deleteRow(row.id, userId);

  return json({ ok: true });
}
