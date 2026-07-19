export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeEmailCaptureDb } from '../../../functions/_lib/email-capture/db';
import { handleEmailCapture } from '../../../functions/_lib/email-capture/handler';

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const db = makeEmailCaptureDb(env.DB);

  return handleEmailCapture(request, {
    insert:      (row) => db.insert(row),
    rateLimitKv: env.RATE_LIMIT,
    dailyCap:    20, // sitewide footer form; office/CGNAT IPs share this budget
    rateKey:     `email-capture:ip:${ip}`,
    newId:       () => crypto.randomUUID(),
  });
};
