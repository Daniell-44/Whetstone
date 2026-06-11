export const prerender = false;

import type { APIContext } from 'astro';
import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { AuditResultSchema } from '../../../functions/_lib/audit/schemas';
import { saveAuditLink } from '../../../functions/_lib/audit-links/storage';

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
  const permalink = `${url.origin}/audit/${id}`;
  return json({ ok: true, id, url: permalink });
}
