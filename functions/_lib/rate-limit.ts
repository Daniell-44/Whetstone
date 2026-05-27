// Narrow interface so the rate-limit helpers work against any KV-alike
// (the real Cloudflare KVNamespace in production; a Map-backed fake in tests).
export interface RateLimitKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface QuotaRecord {
  count: number;
  day:   string; // YYYY-MM-DD UTC
}

export function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function checkAndIncrementQuota(
  kv:  RateLimitKV,
  key: string,
  cap: number,
): Promise<{ allowed: boolean; resetAt: string }> {
  const today  = utcDateString();
  const raw    = await kv.get(key);
  const record: QuotaRecord = raw
    ? (JSON.parse(raw) as QuotaRecord)
    : { count: 0, day: today };

  if (record.day !== today) {
    record.count = 0;
    record.day   = today;
  }

  const resetAt = `${today}T23:59:59Z`;

  if (record.count >= cap) {
    return { allowed: false, resetAt };
  }

  record.count++;
  // TTL 90 000 s (~25 h) so stale keys expire naturally before the next day.
  await kv.put(key, JSON.stringify(record), { expirationTtl: 90_000 });
  return { allowed: true, resetAt };
}
