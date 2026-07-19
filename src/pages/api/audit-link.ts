export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { AuditResultSchema } from '../../../functions/_lib/audit/schemas';
import { saveAuditLink } from '../../../functions/_lib/audit-links/storage';
import { makeAuditLinkIndexDb } from '../../../functions/_lib/audit-links/index-db';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';

const BodySchema = z.object({
  audit:      AuditResultSchema,
  draftText:  z.string().min(1).max(10_000),
  draftTitle: z.string().max(200).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request, url }: APIContext) {
  if (!env.AUDIT_LINKS) {
    return json({ ok: false, error: 'AUDIT_LINKS KV namespace not configured' }, 503);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const id = await saveAuditLink(env.AUDIT_LINKS, parsed.data);

  // Best-effort: when the creator is signed in, record the link in the D1
  // side-index so it appears on /creator/shares. Anonymous shares stay
  // unindexed by design, and an index failure must never break link creation.
  try {
    const session = await getSessionFromRequest(request, makeAuthDb(env.DB));
    if (session) {
      // Index the EXPLICIT title only. Deriving one from the draft's first
      // line would copy up to 200 chars of the user's text into a D1 row
      // outliving the KV payload's 30-day TTL — quietly reversing storage.ts's
      // deliberate ephemerality. No title → the shares page shows the date.
      const title = parsed.data.draftTitle?.trim() || null;
      await makeAuditLinkIndexDb(env.DB).insert(id, session.user_id, title, Date.now());
    }
  } catch (err) {
    console.error('audit-link: failed to index share link', err);
  }

  const permalink = `${url.origin}/audit/${id}`;
  return json({ ok: true, id, url: permalink });
}
