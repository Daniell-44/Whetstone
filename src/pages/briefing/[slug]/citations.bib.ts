export const prerender = false;

import type { APIContext } from 'astro';
import { getAllBriefings } from '../../../lib/briefings';
import { toBibtex } from '../../../../functions/_lib/briefing/citations';

export async function GET({ params }: APIContext) {
  const slug = params.slug;
  if (!slug) return new Response('Not Found', { status: 404 });

  const briefing = getAllBriefings().find((b) => b.slug === slug);
  if (!briefing) return new Response('Not Found', { status: 404 });

  return new Response(toBibtex(briefing), {
    status: 200,
    headers: {
      'Content-Type': 'application/x-bibtex; charset=utf-8',
      'Content-Disposition': `attachment; filename="${briefing.slug}.bib"`,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
