import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { logServerError } from '../functions/_lib/errors/middleware';

export const onRequest = defineMiddleware(async (context, next) => {
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
