export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { makeDialDb, handleDialVote, dialResults } from '../../../functions/_lib/briefing/dial';

// Hosts whose form posts count. Cross-site posts bounce uncounted — a page
// elsewhere distributing taps across its visitors' IPs would defeat both
// the per-IP cap and the meaning of the n=50 gate.
function allowedHosts(): string[] {
  const hosts = ['devils-advocate-site.daniellivingstone2005.workers.dev', 'localhost', '127.0.0.1'];
  try { hosts.unshift(new URL(env.SITE_URL).hostname); } catch { hosts.unshift('thewhetstone.review'); }
  return hosts;
}

// POST: one anonymous dial tap (zero-JS form on the briefing page).
export const POST: APIRoute = async ({ request }) => {
  const db = makeDialDb(env.DB);
  return handleDialVote(request, { db, rateLimitKv: env.RATE_LIMIT, dailyCap: 5, allowedHosts: allowedHosts() });
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
