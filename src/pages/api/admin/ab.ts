export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { makeAuthDb } from '../../../../functions/_lib/auth/db';
import { getSessionFromRequest } from '../../../../functions/_lib/auth/sessions';
import { EXPERIMENTS } from '../../../../functions/_lib/ab/experiments';

const ADMIN_EMAIL = 'daniel.livingstone44@gmail.com';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Returns per-experiment exposure counts plus downstream conversion proxies.
// Conversion is event-name based; for each experiment we report:
//   - exposed_total           : distinct session_hash with experiment_exposure
//   - by_variant.<v>.exposed  : same, sliced by variant
//   - by_variant.<v>.audited  : sessions with both experiment_exposure(variant)
//                               AND audit_completed in the same window
// This is good enough for a first-cut readout. Anything fancier we can build
// once we know which experiments actually matter.
// ---------------------------------------------------------------------------

export async function GET({ request }: APIContext) {
  const authDb  = makeAuthDb(env.DB);
  const session = await getSessionFromRequest(request, authDb);
  if (!session) return json({ error: 'Unauthorised' }, 401);
  const user = await authDb.findUserById(session.user_id);
  if (!user || user.email !== ADMIN_EMAIL) return json({ error: 'Forbidden' }, 403);
  if (!env.DB) return json({ error: 'No DB binding' }, 500);

  const sinceMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const results: Record<string, unknown> = {};

  for (const exp of EXPERIMENTS) {
    const variantStats: Record<string, { exposed: number; audited: number }> = {};

    for (const v of exp.variants) {
      // distinct session_hash count, exposed
      const exposed = await env.DB.prepare(
        `SELECT COUNT(DISTINCT session_hash) AS n
         FROM analytics_events
         WHERE event_name = 'experiment_exposure'
           AND timestamp >= ?1
           AND json_extract(metadata, '$.experiment') = ?2
           AND json_extract(metadata, '$.variant')    = ?3`,
      ).bind(sinceMs, exp.key, v.key).first<{ n: number }>();

      // distinct sessions that hit audit_completed after exposure
      const audited = await env.DB.prepare(
        `SELECT COUNT(DISTINCT a.session_hash) AS n
         FROM analytics_events a
         WHERE a.event_name = 'audit_completed'
           AND a.timestamp >= ?1
           AND a.session_hash IN (
             SELECT session_hash FROM analytics_events
             WHERE event_name = 'experiment_exposure'
               AND timestamp >= ?1
               AND json_extract(metadata, '$.experiment') = ?2
               AND json_extract(metadata, '$.variant')    = ?3
           )`,
      ).bind(sinceMs, exp.key, v.key).first<{ n: number }>();

      variantStats[v.key] = {
        exposed: exposed?.n ?? 0,
        audited: audited?.n ?? 0,
      };
    }

    results[exp.key] = {
      description: exp.description,
      status:      exp.status,
      startedAt:   exp.startedAt,
      winner:      exp.winner,
      window_days: 14,
      by_variant:  variantStats,
    };
  }

  return json({ ok: true, experiments: results });
}
