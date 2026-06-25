import { briefings as dataBriefings } from '../data/briefings';
import { parseBriefingFile } from '../../functions/_lib/briefing/parse';
import type { BriefingArticle } from '../../functions/_lib/briefing/types';

// Markdown-authored briefings (src/content/briefings/*.md) parsed at build.
const files = import.meta.glob('../content/briefings/*.md', { query: '?raw', import: 'default', eager: true });

function slugFromPath(p: string): string {
  return (p.split('/').pop() ?? '').replace(/\.md$/, '');
}

const mdBriefings: BriefingArticle[] = Object.entries(files).map(([path, raw]) =>
  parseBriefingFile(raw as string, slugFromPath(path)),
);

// Markdown wins on slug collision; legacy TS-object briefings fill in the rest.
// Migrate each to markdown over time, then delete it from src/data/briefings.ts.
export function getAllBriefings(): BriefingArticle[] {
  const mdSlugs = new Set(mdBriefings.map((b) => b.slug));
  return [...mdBriefings, ...dataBriefings.filter((b) => !mdSlugs.has(b.slug))]
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
}
