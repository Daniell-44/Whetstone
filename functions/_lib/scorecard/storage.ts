// Scorecard KV storage layer.
//
// Key scheme: "scorecard:<slug>" for each scorecard.
// Enumeration uses kv.list({ prefix: 'scorecard:' }) rather than a separate
// _index key. This avoids the write-consistency problem of keeping two keys
// in sync without transactions. Downside: list() + N get() calls per listing
// rather than one; acceptable at the scale of dozens of scorecards.

import { ScorecardSchema } from './schemas';
import type { Scorecard } from './types';
import { scorecards as fallbackScorecards } from '../../../src/data/scorecards';

const KEY_PREFIX = 'scorecard:';

export async function saveScorecard(kv: KVNamespace, scorecard: Scorecard): Promise<string> {
  const parsed = ScorecardSchema.safeParse(scorecard);
  if (!parsed.success) {
    throw new Error(`Invalid scorecard: ${parsed.error.message}`);
  }
  const key = `${KEY_PREFIX}${parsed.data.slug}`;
  await kv.put(key, JSON.stringify(parsed.data));
  return parsed.data.slug;
}

export async function getScorecard(kv: KVNamespace, slug: string): Promise<Scorecard | null> {
  const raw = await kv.get(`${KEY_PREFIX}${slug}`);
  if (raw !== null) {
    const parsed = ScorecardSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  }
  return fallbackScorecards.find(sc => sc.slug === slug) ?? null;
}

export async function listScorecards(kv: KVNamespace): Promise<Scorecard[]> {
  const listed = await kv.list({ prefix: KEY_PREFIX });
  const kvItems: Scorecard[] = [];
  for (const key of listed.keys) {
    const raw = await kv.get(key.name);
    if (raw !== null) {
      const parsed = ScorecardSchema.safeParse(JSON.parse(raw));
      if (parsed.success) kvItems.push(parsed.data);
    }
  }

  // KV wins on slug collision; fallback fills in anything not in KV.
  const kvSlugs = new Set(kvItems.map(sc => sc.slug));
  const merged = [
    ...kvItems,
    ...fallbackScorecards.filter(sc => !kvSlugs.has(sc.slug)),
  ];

  // Newest first.
  merged.sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
  return merged;
}
