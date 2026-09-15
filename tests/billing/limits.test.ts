import { describe, it, expect } from 'vitest';
import { resolveAuditQuota, waitPhrase, FREE_USE_ALLOWANCE } from '../../functions/_lib/billing/limits';

describe('resolveAuditQuota', () => {
  it('gives everyone the same rolling-24h allowance by default', () => {
    const q = resolveAuditQuota();
    expect(q.cap).toBe(FREE_USE_ALLOWANCE);
    expect(q.period).toBe('rolling24h');
    expect(q.label).toBe(`${FREE_USE_ALLOWANCE} per 24 hours`);
  });

  it('honours a positive operator override', () => {
    expect(resolveAuditQuota(10).cap).toBe(10);
    expect(resolveAuditQuota(10).label).toBe('10 per 24 hours');
  });

  it('floors a fractional override rather than passing it through', () => {
    expect(resolveAuditQuota(4.7).cap).toBe(4);
  });

  it.each([
    ['NaN (parseInt of a junk env var)', NaN],
    ['zero',                             0],
    ['negative',                        -5],
    ['undefined (env var unset)',        undefined],
  ])('falls back to the built-in allowance for %s', (_label, value) => {
    expect(resolveAuditQuota(value as number | undefined).cap).toBe(FREE_USE_ALLOWANCE);
  });
});

describe('waitPhrase', () => {
  const now = Date.UTC(2026, 8, 15, 10, 0, 0);
  const inMs = (ms: number) => new Date(now + ms).toISOString();

  it('counts minutes under an hour', () => {
    expect(waitPhrase(inMs(5 * 60_000), now)).toBe('in 5 minutes');
  });

  it('singularises one minute', () => {
    expect(waitPhrase(inMs(30_000), now)).toBe('in 1 minute');
  });

  it('rounds up to whole hours past the hour mark', () => {
    expect(waitPhrase(inMs(5 * 60 * 60_000), now)).toBe('in about 5 hours');
  });

  it('singularises one hour', () => {
    expect(waitPhrase(inMs(61 * 60_000), now)).toBe('in about 1 hour');
  });

  it('describes a full window as about 24 hours', () => {
    expect(waitPhrase(inMs(24 * 60 * 60_000), now)).toBe('in about 24 hours');
  });

  it('degrades gracefully for a past or unparseable reset', () => {
    expect(waitPhrase(inMs(-1000), now)).toBe('shortly');
    expect(waitPhrase('not-a-date', now)).toBe('shortly');
  });
});
