import { parseBriefingFile } from '../../functions/_lib/briefing/parse';
import type { BriefingArticle } from '../../functions/_lib/briefing/types';

// Draft briefings live in site/drafts/ — OUTSIDE the content glob, so nothing
// here can publish. This loader exists only for the dev-time preview surface
// at /drafts (both routes 404 outside `astro dev`), so Daniel can read and
// edit a draft through the REAL BriefingArticle chassis with hot reload:
// edit drafts/<slug>.md in any editor, the browser re-renders on save.

const files = import.meta.glob('../../drafts/*.md', { query: '?raw', import: 'default', eager: true });

export interface DraftEntry {
  slug: string;
  briefing: BriefingArticle;
  /** Unresolved [OWNER: ...] markers — the edit checklist. */
  ownerMarkers: string[];
  raw: string;
}

function slugFromPath(p: string): string {
  return (p.split('/').pop() ?? '').replace(/\.md$/, '');
}

export function getDrafts(): DraftEntry[] {
  const out: DraftEntry[] = [];
  for (const [path, raw] of Object.entries(files)) {
    const text = raw as string;
    // Only real briefing drafts (front-matter fenced). Skips README etc.
    if (!text.startsWith('---')) continue;
    const slug = slugFromPath(path);
    try {
      const briefing = parseBriefingFile(text, slug);
      const ownerMarkers = [...text.matchAll(/\[OWNER:([^\]]*)\]/g)].map((m) => m[1].trim());
      out.push({ slug, briefing, ownerMarkers, raw: text });
    } catch {
      // A mid-edit syntax error shouldn't kill the whole preview list.
      console.warn(`[drafts] ${slug} failed to parse — fix and save to re-render.`);
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
