import { describe, it, expect } from 'vitest';
import {
  checkAndIncrementQuota,
  quotaIdentity,
  ROLLING_WINDOW_MS,
} from '../../functions/_lib/rate-limit';
import type { RateLimitKV } from '../../functions/_lib/rate-limit';

class FakeKV implements RateLimitKV {
  store = new Map<string, string>();
  async get(key: string): Promise<string | null> { return this.store.get(key) ?? null; }
  async put(key: string, value: string): Promise<void> { this.store.set(key, value); }
}

/** 2026-09-15T10:00:00Z — a fixed mid-day instant so windows are unambiguous. */
const T0 = Date.UTC(2026, 8, 15, 10, 0, 0);

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/audit', { method: 'POST', headers });
}

describe('checkAndIncrementQuota — rolling24h', () => {
  it('allows exactly `cap` uses then blocks', async () => {
    const kv = new FakeKV();
    for (let i = 1; i <= 3; i++) {
      const r = await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(3 - i);
    }
    const blocked = await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('pins the window to the FIRST use, not the latest', async () => {
    const kv = new FakeKV();
    await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0);
    // Two more uses spread across the window must not push the reset out.
    await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0 + 60_000);
    const third = await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0 + 120_000);
    expect(third.resetAt).toBe(new Date(T0 + ROLLING_WINDOW_MS).toISOString());
  });

  it('stays blocked one millisecond before the window closes', async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0);
    const r = await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0 + ROLLING_WINDOW_MS - 1);
    expect(r.allowed).toBe(false);
  });

  it('opens a fresh window exactly at the boundary', async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0);
    const reopened = await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0 + ROLLING_WINDOW_MS);
    expect(reopened.allowed).toBe(true);
    expect(reopened.remaining).toBe(2);
    // The new window is measured from the reopening use, not the original one.
    expect(reopened.resetAt).toBe(new Date(T0 + 2 * ROLLING_WINDOW_MS).toISOString());
  });

  it('reports resetAt as a parseable ISO instant while blocked', async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0);
    const r = await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0 + 1000);
    expect(Number.isNaN(Date.parse(r.resetAt))).toBe(false);
    expect(Date.parse(r.resetAt)).toBeGreaterThan(T0);
  });

  it('treats a record left by a calendar period as a closed window', async () => {
    const kv = new FakeKV();
    // A key that previously ran under period='day' holds a 'YYYY-MM-DD' value.
    kv.store.set('k', JSON.stringify({ count: 99, period: '2026-09-14' }));
    const r = await checkAndIncrementQuota(kv, 'k', 3, 'rolling24h', T0);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it('keeps separate keys independent', async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 3; i++) await checkAndIncrementQuota(kv, 'a', 3, 'rolling24h', T0);
    const other = await checkAndIncrementQuota(kv, 'b', 3, 'rolling24h', T0);
    expect(other.allowed).toBe(true);
  });
});

describe('checkAndIncrementQuota — rolling1h', () => {
  const HOUR = 60 * 60 * 1000;

  it('reopens after an hour, not after a day', async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 2; i++) await checkAndIncrementQuota(kv, 'k', 2, 'rolling1h', T0);
    expect((await checkAndIncrementQuota(kv, 'k', 2, 'rolling1h', T0 + HOUR - 1)).allowed).toBe(false);
    expect((await checkAndIncrementQuota(kv, 'k', 2, 'rolling1h', T0 + HOUR)).allowed).toBe(true);
  });

  it('reports resetAt one hour past the first use', async () => {
    const kv = new FakeKV();
    const r  = await checkAndIncrementQuota(kv, 'k', 2, 'rolling1h', T0);
    expect(r.resetAt).toBe(new Date(T0 + HOUR).toISOString());
  });

  it('does not share a window with the 24h period on the same key', async () => {
    const kv = new FakeKV();
    await checkAndIncrementQuota(kv, 'k', 1, 'rolling1h', T0);
    // Still inside the hour, so the 1h window is spent...
    expect((await checkAndIncrementQuota(kv, 'k', 1, 'rolling1h', T0 + 60_000)).allowed).toBe(false);
    // ...but past it, a fresh window opens.
    expect((await checkAndIncrementQuota(kv, 'k', 1, 'rolling1h', T0 + HOUR + 1)).allowed).toBe(true);
  });
});

describe('checkAndIncrementQuota — calendar periods still work', () => {
  it('day: resets when the UTC date rolls over', async () => {
    const kv = new FakeKV();
    for (let i = 0; i < 2; i++) await checkAndIncrementQuota(kv, 'k', 2, 'day', T0);
    expect((await checkAndIncrementQuota(kv, 'k', 2, 'day', T0)).allowed).toBe(false);
    const nextDay = Date.UTC(2026, 8, 16, 0, 0, 0);
    expect((await checkAndIncrementQuota(kv, 'k', 2, 'day', nextDay)).allowed).toBe(true);
  });

  it('month: resetAt is the first instant of next month', async () => {
    const kv = new FakeKV();
    const r = await checkAndIncrementQuota(kv, 'k', 5, 'month', T0);
    expect(r.resetAt).toBe(new Date(Date.UTC(2026, 9, 1)).toISOString());
  });

  it('month: rolls the year over from December', async () => {
    const kv = new FakeKV();
    const dec = Date.UTC(2026, 11, 20, 0, 0, 0);
    const r = await checkAndIncrementQuota(kv, 'k', 5, 'month', dec);
    expect(r.resetAt).toBe(new Date(Date.UTC(2027, 0, 1)).toISOString());
  });
});

describe('quotaIdentity', () => {
  it('prefers the user id when signed in', () => {
    expect(quotaIdentity(req({ 'CF-Connecting-IP': '1.2.3.4' }), 'u_42')).toBe('user:u_42');
  });

  it('falls back to the Cloudflare client IP', () => {
    expect(quotaIdentity(req({ 'CF-Connecting-IP': '1.2.3.4' }))).toBe('ip:1.2.3.4');
  });

  it('falls back to X-Forwarded-For when CF-Connecting-IP is absent', () => {
    expect(quotaIdentity(req({ 'X-Forwarded-For': '5.6.7.8' }))).toBe('ip:5.6.7.8');
  });

  it('degrades to a shared "unknown" bucket with no IP headers', () => {
    expect(quotaIdentity(req())).toBe('ip:unknown');
  });

  it('treats null and empty-string user ids as anonymous', () => {
    expect(quotaIdentity(req({ 'CF-Connecting-IP': '1.2.3.4' }), null)).toBe('ip:1.2.3.4');
    expect(quotaIdentity(req({ 'CF-Connecting-IP': '1.2.3.4' }), '')).toBe('ip:1.2.3.4');
  });
});
