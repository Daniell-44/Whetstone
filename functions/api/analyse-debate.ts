// POST /api/analyse-debate
//
// Expensive endpoint — multiple LLM calls per request. Gated by X-Analyser-Secret
// so only the curator can invoke it. Does NOT go through /api/llm (that endpoint
// applies per-device end-user quotas; this endpoint must not be subject to them).

import { GeminiProvider } from '../_lib/providers/gemini';
import { DebateInputSchema } from '../_lib/scorecard/schemas';
import { generateScorecard } from '../_lib/scorecard/engine';

// ---------------------------------------------------------------------------
// Cloudflare Pages Function env
// ---------------------------------------------------------------------------

interface Env {
  GEMINI_API_KEY?:   string;
  ANALYSER_SECRET?:  string;
}

interface PagesContext {
  request: Request;
  env:     Env;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Auth gate — must match ANALYSER_SECRET env var.
  const secret = request.headers.get('X-Analyser-Secret');
  if (!env.ANALYSER_SECRET || secret !== env.ANALYSER_SECRET) {
    return json({ error: 'unauthorized', message: 'Valid X-Analyser-Secret header required' }, 401);
  }

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'service_unavailable', message: 'LLM key not configured' }, 503);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON body' }, 400);
  }

  const parsed = DebateInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      { error: 'validation_failed', message: 'Invalid debate input', issues: parsed.error.issues },
      400,
    );
  }

  try {
    const { scorecard, usage } = await generateScorecard(parsed.data, {
      provider: new GeminiProvider(),
      apiKey:   env.GEMINI_API_KEY,
    });
    return json({ scorecard, usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown engine error';
    return json({ error: 'engine_error', message }, 500);
  }
};
