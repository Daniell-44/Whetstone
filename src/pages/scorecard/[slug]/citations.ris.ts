export const prerender = false;

import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { getScorecard } from '../../../../functions/_lib/scorecard/storage';
import { toRis } from '../../../../functions/_lib/scorecard/citations';

export async function GET({ params }: APIContext) {
  const slug = params.slug;
  if (!slug) return new Response('Not Found', { status: 404 });

  const scorecard = await getScorecard(env.SCORECARDS, slug);
  if (!scorecard) return new Response('Not Found', { status: 404 });

  const body = toRis(scorecard);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-research-info-systems; charset=utf-8',
      'Content-Disposition': `attachment; filename="${scorecard.slug}.ris"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
