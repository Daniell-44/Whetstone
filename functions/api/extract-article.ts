// POST /api/extract-article
//
// Given a URL, fetches the page and extracts clean article text, title, and
// publication name. Returns the result directly — extraction failure is a
// normal outcome (ok: false) that the UI should handle by falling back to
// a manual paste box. Gated by the same X-Analyser-Secret auth as
// /api/analyse-debate.

import { z }                from 'zod';
import { fetchAndExtract }  from '../_lib/extract/article';

// ---------------------------------------------------------------------------
// Cloudflare Pages Function env
// ---------------------------------------------------------------------------

interface Env {
  ANALYSER_SECRET?: string;
}

interface PagesContext {
  request: Request;
  env:     Env;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  url: z.string().url(),
});

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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON body' }, 400);
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      { error: 'validation_failed', message: 'Body must be { url: string }', issues: parsed.error.issues },
      400,
    );
  }

  // Extraction failures (ok: false) are a normal outcome — return 200.
  const result = await fetchAndExtract(parsed.data.url);
  return json(result);
};
