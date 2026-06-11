// Narrow interface so the rate-limit helpers work against any KV-alike
// (the real Cloudflare KVNamespace in production; a Map-backed fake in tests).
export interface RateLimitKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export type QuotaPeriod = 'day' | 'month';

interface QuotaRecord {
  count:  number;
  period: string; // 'YYYY-MM-DD' for day, 'YYYY-MM' for month
}

export function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
}

export function utcMonthString(): string {
  return new Date().toISOString().slice(0, 7);    // YYYY-MM
}

function periodKey(period: QuotaPeriod): string {
  return period === 'month' ? utcMonthString() : utcDateString();
}

// TTL: a bit over the period length so stale keys expire naturally.
// Day → ~25h. Month → ~32 days.
function periodTtl(period: QuotaPeriod): number {
  return period === 'month' ? 32 * 24 * 60 * 60 : 90_000;
}

/**
 * Check and increment a usage quota. Defaults to a daily period (all existing
 * callers rely on this). Pass period='month' for monthly caps (paid tiers).
 */
export async function checkAndIncrementQuota(
  kv:      RateLimitKV,
  key:     string,
  cap:     number,
  period:  QuotaPeriod = 'day',
): Promise<{ allowed: boolean; resetAt: string; remaining: number }> {
  const current = periodKey(period);
  const raw     = await kv.get(key);
  const record: QuotaRecord = raw
    ? (JSON.parse(raw) as QuotaRecord)
    : { count: 0, period: current };

  if (record.period !== current) {
    record.count  = 0;
    record.period = current;
  }

  const resetAt = period === 'month'
    ? `${current}-01T00:00:00Z (next month)`
    : `${current}T23:59:59Z`;

  if (record.count >= cap) {
    return { allowed: false, resetAt, remaining: 0 };
  }

  record.count++;
  await kv.put(key, JSON.stringify(record), { expirationTtl: periodTtl(period) });
  return { allowed: true, resetAt, remaining: Math.max(0, cap - record.count) };
}
