export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { getLiveBriefings } from '../../../lib/briefings';
import { buildCatalog, handlePlacementRequest } from '../../../lib/extension-api/placement';

// Tier-1 placement for the extension rebuild: match the submitted argument
// against the live audited briefings (Extension_Rebuild_Plan_v1.md §5).
// The catalog is built once per isolate from the bundled briefing corpus.
const provider = new GeminiProvider();
const catalog = buildCatalog(getLiveBriefings());

export const POST: APIRoute = async ({ request }) => {
  const db = makeAuthDb(env.DB);
  return handlePlacementRequest(request, {
    rateLimitKv: env.RATE_LIMIT,
    geminiApiKey: env.GEMINI_API_KEY,
    provider,
    catalog,
    dailyCap: parseInt(env.AUDIT_DAILY_CAP ?? '10', 10),
    userDailyCap: parseInt(env.AUDIT_USER_DAILY_CAP ?? '50', 10),
    getSession: (req) => getSessionFromRequest(req, db).then((s) => (s ? { userId: s.user_id } : null)),
    siteBase: env.SITE_URL ?? 'https://thewhetstone.review',
    // Tier-2 conversation cache rides the RATE_LIMIT namespace under its own
    // key prefix (placecache:v1:) — a separate binding is a later decision.
    cacheKv: env.RATE_LIMIT,
  });
};
