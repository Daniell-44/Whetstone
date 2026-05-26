// POST /api/save-scorecard
//
// Validates a Scorecard body and persists it to the SCORECARDS KV namespace.
// Gated by X-Analyser-Secret (same pattern as analyse-debate.ts).

import { ScorecardSchema } from '../_lib/scorecard/schemas';
import { saveScorecard } from '../_lib/scorecard/storage';

interface Env {
  SCORECARDS:       KVNamespace;
  ANALYSER_SECRET?: string;
}

interface PagesContext {
  request: Request;
  env:     Env;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const secret = request.headers.get('X-Analyser-Secret');
  if (!env.ANALYSER_SECRET || secret !== env.ANALYSER_SECRET) {
    return json({ error: 'unauthorized', message: 'Valid X-Analyser-Secret header required' }, 401);
  }

  if (!env.SCORECARDS) {
    return json({ error: 'service_unavailable', message: 'SCORECARDS KV binding not configured' }, 503);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON body' }, 400);
  }

  const parsed = ScorecardSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      { error: 'validation_failed', message: 'Invalid scorecard', issues: parsed.error.issues },
      400,
    );
  }

  try {
    const slug = await saveScorecard(env.SCORECARDS, parsed.data);
    return json({ slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown storage error';
    return json({ error: 'storage_error', message }, 500);
  }
};
