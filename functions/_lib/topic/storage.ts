// Topic-page KV storage. Mirrors the scorecard pattern: one key per topic,
// enumerate via list() rather than a separate index key.

import { StoredTopicSchema } from './schemas';
import type { StoredTopic } from './types';

const KEY_PREFIX = 'topic:';

export async function saveTopic(kv: KVNamespace, topic: StoredTopic): Promise<string> {
  const parsed = StoredTopicSchema.safeParse(topic);
  if (!parsed.success) {
    throw new Error(`Invalid topic: ${parsed.error.issues[0]?.message ?? parsed.error.message}`);
  }
  await kv.put(`${KEY_PREFIX}${parsed.data.slug}`, JSON.stringify(parsed.data));
  return parsed.data.slug;
}

export async function getTopic(kv: KVNamespace, slug: string): Promise<StoredTopic | null> {
  const raw = await kv.get(`${KEY_PREFIX}${slug}`);
  if (raw === null) return null;
  const parsed = StoredTopicSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function listTopics(kv: KVNamespace, opts?: { publishedOnly?: boolean }): Promise<StoredTopic[]> {
  const listed = await kv.list({ prefix: KEY_PREFIX });
  const items: StoredTopic[] = [];
  for (const key of listed.keys) {
    const raw = await kv.get(key.name);
    if (raw === null) continue;
    const parsed = StoredTopicSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      if (opts?.publishedOnly && parsed.data.status !== 'published') continue;
      items.push(parsed.data);
    }
  }
  items.sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
  return items;
}

export async function deleteTopic(kv: KVNamespace, slug: string): Promise<void> {
  await kv.delete(`${KEY_PREFIX}${slug}`);
}
