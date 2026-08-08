import { describe, it, expect } from 'vitest';
import { handleDialVote, dialResults, parseDialStep, RESULTS_FLOOR } from '../../functions/_lib/briefing/dial';

function fakeDb() {
  const rows = new Map<string, number>();
  return {
    rows,
    increment: async (slug: string, step: number) => {
      const k = `${slug}|${step}`;
      rows.set(k, (rows.get(k) ?? 0) + 1);
    },
    counts: async (slug: string) =>
      [...rows.entries()]
        .filter(([k]) => k.startsWith(`${slug}|`))
        .map(([k, n]) => ({ step: Number(k.split('|')[1]), n })),
  };
}

function post(body: Record<string, string>, ip = '1.2.3.4') {
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) form.set(k, v);
  return new Request('https://example.org/api/briefing-dial', {
    method: 'POST',
    body: form,
    headers: { 'CF-Connecting-IP': ip },
  });
}

describe('parseDialStep', () => {
  it('accepts exactly the five steps', () => {
    for (const s of ['-2', '-1', '0', '1', '2']) expect(parseDialStep(s)).toBe(Number(s));
  });
  it('rejects everything else', () => {
    for (const s of ['3', '-3', '1.5', 'x', '', '00', 'NaN']) expect(parseDialStep(s)).toBeNull();
    expect(parseDialStep(null)).toBeNull();
  });
});

describe('handleDialVote', () => {
  it('counts a valid tap and bounces back to the thanks anchor', async () => {
    const db = fakeDb();
    const res = await handleDialVote(post({ slug: 'nuclear-costings-parent', step: '-1' }), { db });
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/briefing/nuclear-costings-parent#dial-thanks');
    expect(db.rows.get('nuclear-costings-parent|-1')).toBe(1);
  });

  it('rejects a bad step without counting', async () => {
    const db = fakeDb();
    const res = await handleDialVote(post({ slug: 'nuclear-costings-parent', step: '7' }), { db });
    expect(res.status).toBe(303);
    expect(db.rows.size).toBe(0);
  });

  it('rejects a junk slug without counting', async () => {
    const db = fakeDb();
    const res = await handleDialVote(post({ slug: '../etc/passwd', step: '0' }), { db });
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/');
    expect(db.rows.size).toBe(0);
  });

  it('stops counting past the per-IP daily cap but still bounces politely', async () => {
    const db = fakeDb();
    const kv = new Map<string, string>();
    const deps = {
      db,
      dailyCap: 2,
      rateLimitKv: {
        get: async (k: string) => kv.get(k) ?? null,
        put: async (k: string, v: string) => void kv.set(k, v),
      },
    };
    for (let i = 0; i < 4; i++) await handleDialVote(post({ slug: 'a-briefing', step: '2' }), deps);
    expect(db.rows.get('a-briefing|2')).toBe(2);
  });
});

describe('dialResults', () => {
  it('gates the shape below the floor', async () => {
    const db = fakeDb();
    for (let i = 0; i < RESULTS_FLOOR - 1; i++) await db.increment('s', 1);
    const out = await dialResults(db, 's');
    expect(out.gated).toBe(true);
    expect(out.total).toBe(RESULTS_FLOOR - 1);
    expect('counts' in out).toBe(false);
  });

  it('opens at the floor with every step present, zeros included', async () => {
    const db = fakeDb();
    for (let i = 0; i < 30; i++) await db.increment('s', -2);
    for (let i = 0; i < 20; i++) await db.increment('s', 2);
    const out = await dialResults(db, 's');
    expect(out.gated).toBe(false);
    if (!out.gated) {
      expect(out.counts).toEqual({ '-2': 30, '-1': 0, '0': 0, '1': 0, '2': 20 });
    }
  });

  it('treats an invalid slug as empty and gated', async () => {
    const out = await dialResults(fakeDb(), 'NOT A SLUG');
    expect(out).toEqual({ total: 0, gated: true });
  });
});
