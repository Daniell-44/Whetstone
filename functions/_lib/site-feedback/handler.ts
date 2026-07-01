import { z } from 'zod';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

// Global qualitative site feedback (the /feedback page). Kept separate from the
// engine/lens feedback in ../feedback — that one is authenticated and tied to
// findings; this is open-ended visitor feedback, anonymous-friendly.

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BodySchema = z.object({
  message: z.string().trim().min(1, 'Please write a message.').max(4000, 'Message is too long.'),
  // Optional — allow empty string (unfilled field) or a valid address.
  email:   z.union([z.string().trim().email('That email looks off.').max(200), z.literal('')]).optional(),
  path:    z.string().max(300).optional(),
});

export interface SiteFeedbackRow {
  id:          string;
  message:     string;
  email:       string | null;
  source_path: string | null;
  user_id:     string | null;
  created_at:  number;
}

export interface SiteFeedbackDeps {
  insert:       (row: SiteFeedbackRow) => Promise<void>;
  rateLimitKv?: RateLimitKV;
  dailyCap:     number;
  rateKey:      string;               // per-IP key so one client can't flood
  newId:        () => string;
  userId?:      string | null;        // best-effort, when a session exists
}

export async function handleSiteFeedback(req: Request, deps: SiteFeedbackDeps): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } }, 405);
  }

  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(deps.rateLimitKv, deps.rateKey, deps.dailyCap);
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many submissions — try again tomorrow.' } }, 429);
    }
  }

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  const { message, email, path } = parsed.data;
  await deps.insert({
    id:          deps.newId(),
    message,
    email:       email && email.length > 0 ? email : null,
    source_path: path && path.length > 0 ? path : null,
    user_id:     deps.userId ?? null,
    created_at:  Date.now(),
  });

  return json({ ok: true });
}
