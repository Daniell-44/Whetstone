import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { logServerError } from '../functions/_lib/errors/middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Canonical-domain redirect: the legacy thewhetstone.net (and its www) 301 to
  // the new canonical thewhetstone.review. *.workers.dev is left alone (it's the
  // dev/testing fallback).
  const reqUrl = new URL(context.request.url);
  // NB: skip /api/* — a 301 turns a POST into a GET, which would break API
  // clients (e.g. the extension still calling thewhetstone.net/api/audit). The
  // worker serves the same API on both hosts, so leave API traffic un-redirected.
  if (
    (reqUrl.hostname === 'thewhetstone.net' || reqUrl.hostname === 'www.thewhetstone.net')
    && !reqUrl.pathname.startsWith('/api/')
  ) {
    reqUrl.hostname = 'thewhetstone.review';
    reqUrl.protocol = 'https:';
    return new Response(null, { status: 301, headers: { Location: reqUrl.toString() } });
  }

  try {
    const response = await next();

    // Log server errors (5xx) — the response already went out but we capture it
    if (response.status >= 500 && env.DB) {
      void logServerError(env.DB, context.request, response.status, new Error(`HTTP ${response.status}`));
    }

    return response;
  } catch (error) {
    // Uncaught exception — log it, then re-throw so Astro returns 500
    if (env.DB) {
      void logServerError(env.DB, context.request, 500, error);
    }
    throw error;
  }
});
