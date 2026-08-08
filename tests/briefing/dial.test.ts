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

function fakeKv(behaviour: 'ok' | 'throws' = 'ok') {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => {
      if (behaviour === 'throws') throw new Error('KV down');
      return store.get(k) ?? null;
    },
    put: async (k: string, v: string) => {
      if (behaviour === 'throws') throw new Error('KV down');
      store.set(k, v);
    },
  };
}

const HOST = 'thewhetstone.review';

function post(body: Record<string, string>, headers: Record<string, string> = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) form.set(k, v);
  return new Request('https://thewhetstone.review/api/briefing-dial', {
    method: 'POST',
    body: form,
    headers: { 'CF-Connecting-IP': '1.2.3.4', Origin: `https://${HOST}`, ...headers },
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
    const res = await handleDialVote(post({ slug: 'nuclear-costings-parent', step: '-1' }), { db, allowedHosts: [HOST] });
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/briefing/nuclear-costings-parent#dial-thanks');
    expect(db.rows.get('nuclear-costings-parent|-1')).toBe(1);
  });

  it('rejects a bad step without counting', async () => {
    const db = fakeDb();
    const res = await handleDialVote(post({ slug: 'nuclear-costings-parent', step: '7' }), { db, allowedHosts: [HOST] });
    expect(res.status).toBe(303);
    expect(db.rows.size).toBe(0);
  });

  it('rejects a junk slug without counting', async () => {
    const db = fakeDb();
    const res = await handleDialVote(post({ slug: '../etc/passwd', step: '0' }), { db, allowedHosts: [HOST] });
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/');
    expect(db.rows.size).toBe(0);
  });

  it('caps per IP per day and sends capped taps to the HONEST limit line, never the thanks line', async () => {
    const db = fakeDb();
    const deps = { db, dailyCap: 2, rateLimitKv: fakeKv(), allowedHosts: [HOST] };
    const locations: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await handleDialVote(post({ slug: 'a-briefing', step: '2' }), deps);
      locations.push(res.headers.get('Location'));
    }
    expect(db.rows.get('a-briefing|2')).toBe(2);
    expect(locations[0]).toBe('/briefing/a-briefing#dial-thanks');
    expect(locations[2]).toBe('/briefing/a-briefing#dial-limit');
    expect(locations[3]).toBe('/briefing/a-briefing#dial-limit');
  });

  it('fails OPEN when KV throws: the vote counts, no 500 reaches the reader', async () => {
    const db = fakeDb();
    const res = await handleDialVote(post({ slug: 'a-briefing', step: '1' }), {
      db, dailyCap: 2, rateLimitKv: fakeKv('throws'), allowedHosts: [HOST],
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/briefing/a-briefing#dial-thanks');
    expect(db.rows.get('a-briefing|1')).toBe(1);
  });

  it('bounces a cross-site Origin uncounted', async () => {
    const db = fakeDb();
    const res = await handleDialVote(
      post({ slug: 'a-briefing', step: '0' }, { Origin: 'https://evil.example' }),
      { db, allowedHosts: [HOST] },
    );
    expect(res.status).toBe(303);
    expect(res.headers.get('X-Dial')).toBe('ignored');
    expect(db.rows.size).toBe(0);
  });

  it('accepts a missing Origin only alongside Sec-Fetch-Site: same-origin', async () => {
    const db = fakeDb();
    const noOrigin = (extra: Record<string, string>) => {
      const form = new FormData();
      form.set('slug', 'a-briefing'); form.set('step', '0');
      return new Request('https://thewhetstone.review/api/briefing-dial', { method: 'POST', body: form, headers: extra });
    };
    const ok = await handleDialVote(noOrigin({ 'Sec-Fetch-Site': 'same-origin' }), { db, allowedHosts: [HOST] });
    expect(ok.headers.get('X-Dial')).toBe('counted');
    const bad = await handleDialVote(noOrigin({}), { db, allowedHosts: [HOST] });
    expect(bad.headers.get('X-Dial')).toBe('ignored');
    expect(db.rows.get('a-briefing|0')).toBe(1);
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
