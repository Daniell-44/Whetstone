export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeDialDb, handleDialVote, dialResults } from '../../../functions/_lib/briefing/dial';

// POST: one anonymous dial tap (zero-JS form on the briefing page).
export const POST: APIRoute = async ({ request }) => {
  const db = makeDialDb(env.DB);
  return handleDialVote(request, { db, rateLimitKv: env.RATE_LIMIT, dailyCap: 5 });
};

// GET ?slug=<briefing>: gated counts. Below fifty answers only the total
// comes back — the shape of early votes is not a finding.
export const GET: APIRoute = async ({ url }) => {
  const db = makeDialDb(env.DB);
  const out = await dialResults(db, url.searchParams.get('slug') ?? '');
  return new Response(JSON.stringify(out), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
