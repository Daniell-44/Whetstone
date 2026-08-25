export const prerender = false;

import type { APIRoute } from 'astro';

// Moved to /api/mini on 2026-08-25. The path said "extension" because the
// extension was the first caller; the endpoint is now the site's own Ask mode
// and the extension build is frozen. 308 rather than 301 or 302: this is a
// POST endpoint, and only 308 obliges a client to repeat the method and body
// at the new address.
const MOVED_TO = '/api/mini';

const redirect: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  return new Response(null, {
    status:  308,
    headers: { Location: `${MOVED_TO}${url.search}` },
  });
};

export const POST = redirect;
export const GET  = redirect;
