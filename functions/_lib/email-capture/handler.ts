import { z } from 'zod';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';
import type { EmailCaptureRow, EmailCaptureSource } from './db';

// Email capture (briefing updates / extension launch notice). Mirrors the
// site-feedback handler: anonymous, per-IP daily KV cap, zod-validated body.
// No provider is wired yet — rows just accumulate in D1 until a sender exists.
//
// Duplicate policy: the db layer uses INSERT OR IGNORE against
// UNIQUE(email, source), and this handler returns ok:true either way. The
// response must never reveal whether an address was already on the list.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BodySchema = z.object({
  email:  z.string().trim().toLowerCase().min(1, 'Please enter an email address.').max(254, 'That email is too long.').email('That email looks off.'),
  source: z.enum(['briefing', 'extension', 'footer']),
});

export interface EmailCaptureDeps {
  /** Must behave like INSERT OR IGNORE: duplicates are a silent no-op. */
  insert:       (row: EmailCaptureRow) => Promise<void>;
  rateLimitKv?: RateLimitKV;
  dailyCap:     number;
  rateKey:      string;               // per-IP key so one client can't flood
  newId:        () => string;
}

export async function handleEmailCapture(req: Request, deps: EmailCaptureDeps): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } }, 405);
  }

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  // Quota AFTER validation: a typo'd address must not burn the shared per-IP
  // budget (this form sits in the sitewide footer, so office/CGNAT IPs share it).
  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(deps.rateLimitKv, deps.rateKey, deps.dailyCap);
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts today. Try again tomorrow.' } }, 429);
    }
  }

  const { email, source } = parsed.data;
  await deps.insert({
    id:         deps.newId(),
    email,
    source:     source as EmailCaptureSource,
    created_at: Date.now(),
  });

  return json({ ok: true });
}
