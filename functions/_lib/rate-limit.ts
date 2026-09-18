// Narrow interface so the rate-limit helpers work against any KV-alike
// (the real Cloudflare KVNamespace in production; a Map-backed fake in tests).
export interface RateLimitKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export type QuotaPeriod = 'day' | 'month' | 'rolling1h' | 'rolling24h';

interface QuotaRecord {
  count:  number;
  /**
   * Identifies the window the count belongs to:
   *   day          → 'YYYY-MM-DD'
   *   month        → 'YYYY-MM'
   *   rolling1h/24h → epoch-ms of the window's FIRST use, as a string
   *
   * Reusing one field keeps every record shape-compatible, so a key can change
   * period without a migration — a record from the old period simply reads as
   * expired and starts a fresh window.
   */
  period: string;
}

/**
 * Rolling windows measure from the caller's first use, not from a calendar
 * boundary — someone arriving at 11pm gets a full window, not an hour of one.
 */
const ROLLING_WINDOWS = {
  rolling1h:  60 * 60 * 1000,
  rolling24h: 24 * 60 * 60 * 1000,
} as const;

/** Length of the default (24h) rolling window. */
export const ROLLING_WINDOW_MS = ROLLING_WINDOWS.rolling24h;

function rollingWindowMs(period: QuotaPeriod): number | null {
  return period in ROLLING_WINDOWS
    ? ROLLING_WINDOWS[period as keyof typeof ROLLING_WINDOWS]
    : null;
}

export function utcDateString(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);   // YYYY-MM-DD
}

export function utcMonthString(nowMs: number = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 7);    // YYYY-MM
}

/**
 * Rate-limit identity for a request. Signed-in callers are keyed by user id so
 * the allowance follows the account across devices; everyone else falls back to
 * the client IP, the best anonymous handle Cloudflare gives us.
 *
 * IP keying is deliberately imperfect — shared NAT lumps strangers together,
 * and a new IP resets the count. It is a friction device for an open tool, not
 * an access control, so erring toward over-sharing a quota is the safer bias.
 */
export function quotaIdentity(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const ip = request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('X-Forwarded-For')
    ?? 'unknown';
  return `ip:${ip}`;
}

/** The window value a brand-new record should carry. */
function freshPeriod(period: QuotaPeriod, nowMs: number): string {
  if (rollingWindowMs(period) !== null) return String(nowMs);
  if (period === 'month')               return utcMonthString(nowMs);
  return utcDateString(nowMs);
}

/** Has the stored window closed, so the count should start over? */
function windowExpired(record: QuotaRecord, period: QuotaPeriod, nowMs: number): boolean {
  const windowMs = rollingWindowMs(period);
  if (windowMs !== null) {
    const startedAt = Number(record.period);
    // A non-numeric value means the key last ran under a calendar period.
    // Treat it as expired rather than trusting a meaningless window start.
    if (!Number.isFinite(startedAt)) return true;
    return nowMs - startedAt >= windowMs;
  }
  return record.period !== freshPeriod(period, nowMs);
}

/** When the caller's allowance next frees up, as an ISO-8601 instant. */
function resetAtFor(record: QuotaRecord, period: QuotaPeriod, nowMs: number): string {
  const windowMs = rollingWindowMs(period);
  if (windowMs !== null) {
    return new Date(Number(record.period) + windowMs).toISOString();
  }
  if (period === 'month') {
    const [y, m] = utcMonthString(nowMs).split('-').map(Number) as [number, number];
    return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString();
  }
  return `${utcDateString(nowMs)}T23:59:59Z`;
}

// TTL: comfortably longer than the window so a key cannot expire mid-window,
// but short enough that stale keys clear themselves. Cloudflare KV enforces a
// 60s floor, which every value here clears.
function periodTtl(period: QuotaPeriod): number {
  if (period === 'month') return 32 * 24 * 60 * 60;
  const windowMs = rollingWindowMs(period);
  if (windowMs !== null) return Math.ceil((windowMs * 2) / 1000);
  return 90_000; // 'day' → ~25h
}

/**
 * Check and increment a usage quota. Defaults to a daily period (all existing
 * calendar callers rely on this). Pass period='month' for monthly caps, or
 * 'rolling1h'/'rolling24h' for a window that opens on the caller's first use.
 *
 * `nowMs` is injectable so tests can advance time without faking timers.
 */
export async function checkAndIncrementQuota(
  kv:      RateLimitKV,
  key:     string,
  cap:     number,
  period:  QuotaPeriod = 'day',
  nowMs:   number = Date.now(),
): Promise<{ allowed: boolean; resetAt: string; remaining: number }> {
  const raw    = await kv.get(key);
  const record: QuotaRecord = raw
    ? (JSON.parse(raw) as QuotaRecord)
    : { count: 0, period: freshPeriod(period, nowMs) };

  if (windowExpired(record, period, nowMs)) {
    record.count  = 0;
    record.period = freshPeriod(period, nowMs);
  }

  const resetAt = resetAtFor(record, period, nowMs);

  if (record.count >= cap) {
    return { allowed: false, resetAt, remaining: 0 };
  }

  record.count++;
  await kv.put(key, JSON.stringify(record), { expirationTtl: periodTtl(period) });
  return { allowed: true, resetAt, remaining: Math.max(0, cap - record.count) };
}
