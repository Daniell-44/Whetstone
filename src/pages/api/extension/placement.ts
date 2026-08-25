export const prerender = false;

import type { APIRoute } from 'astro';

// Moved to /api/placement on 2026-08-25. Placement is a stage of the audit,
// not a client feature, and the extension that gave the path its name is
// frozen. 308 preserves the POST method and body at the new address.
const MOVED_TO = '/api/placement';

const redirect: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  return new Response(null, {
    status:  308,
    headers: { Location: `${MOVED_TO}${url.search}` },
  });
};

export const POST = redirect;
export const GET  = redirect;
