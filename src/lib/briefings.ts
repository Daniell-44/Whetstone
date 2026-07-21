import { parseBriefingFile, validateBriefing } from '../../functions/_lib/briefing/parse';
import type { BriefingArticle } from '../../functions/_lib/briefing/types';

// Markdown-authored briefings (src/content/briefings/*.md) parsed at build.
const files = import.meta.glob('../content/briefings/*.md', { query: '?raw', import: 'default', eager: true });

function slugFromPath(p: string): string {
  return (p.split('/').pop() ?? '').replace(/\.md$/, '');
}

// Parse every file defensively: a malformed .md logs and is skipped rather than
// crashing the whole build (which would blank the entire feed). Authoring
// mistakes that still parse are surfaced as warnings via validateBriefing.
const mdBriefings: BriefingArticle[] = Object.entries(files).flatMap(([path, raw]) => {
  const slug = slugFromPath(path);
  try {
    const b = parseBriefingFile(raw as string, slug);
    for (const w of validateBriefing(b)) console.warn(`[briefing:${slug}] ${w}`);
    return [b];
  } catch (err) {
    console.error(`[briefing:${slug}] failed to parse — skipped. Fix the file and rebuild.\n`, err);
    return [];
  }
});

export function getAllBriefings(): BriefingArticle[] {
  return [...mdBriefings].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
}

/** The publication surfaces (home feed, related rails, next-briefing links)
   show only non-archived work. Archived pieces keep their pages, deep links,
   and citations — use getAllBriefings for anything that resolves a slug. */
export function getLiveBriefings(): BriefingArticle[] {
  return getAllBriefings().filter((b) => !b.archived);
}

export function getArchivedBriefings(): BriefingArticle[] {
  return getAllBriefings().filter((b) => b.archived);
}
