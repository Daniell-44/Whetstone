import { describe, it, expect, beforeEach } from 'vitest';
import { saveScorecard, getScorecard, listScorecards } from '../../functions/_lib/scorecard/storage';
import type { Scorecard } from '../../functions/_lib/scorecard/types';

// ---------------------------------------------------------------------------
// Fake KV — Map-backed, implements only the surface used by storage.ts
// ---------------------------------------------------------------------------

class FakeKV {
  private store = new Map<string, string>();

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async list(opts?: { prefix?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean }> {
    const prefix = opts?.prefix ?? '';
    const keys = [...this.store.keys()]
      .filter(k => k.startsWith(prefix))
      .map(name => ({ name }));
    return { keys, list_complete: true };
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MIN_SCORECARD: Scorecard = {
  slug:          'test-debate',
  question:      'Is this a valid test?',
  dek:           'A short test scorecard for storage unit tests.',
  publishedDate: '2026-01-15',
  positions: [
    {
      label:     'Yes',
      bestCase:  { claim: 'Tests are valid.', grounds: 'CI says so.', warrant: 'CI is trustworthy.' },
      fatalFlaw: { name: 'Tautology', explanation: 'Proves itself by assuming itself.' },
      sources:   [{ title: 'Test Source', publication: 'Test Journal', url: 'https://example.com' }],
    },
    {
      label:     'No',
      bestCase:  { claim: 'Tests are invalid.', grounds: 'Murphy says so.', warrant: 'Murphy is always right.' },
      fatalFlaw: { name: 'Pessimism Bias', explanation: 'Assumes failure without evidence.' },
      sources:   [{ title: 'Source 2', publication: 'Journal 2', url: 'https://example.com/2' }],
    },
  ],
  metaAnalysis: {
    bridgingWarrant: 'Both sides assume tests are binary.',
    explanation:     'Neither side considers partial validity.',
  },
};

const SECOND_SCORECARD: Scorecard = {
  ...MIN_SCORECARD,
  slug:          'second-debate',
  question:      'Should this be a second scorecard?',
  dek:           'A second scorecard for merge/dedup tests.',
  publishedDate: '2026-03-20',
};

// ---------------------------------------------------------------------------
// saveScorecard
// ---------------------------------------------------------------------------

describe('saveScorecard', () => {
  it('returns the slug on success', async () => {
    const kv = new FakeKV() as unknown as KVNamespace;
    const slug = await saveScorecard(kv, MIN_SCORECARD);
    expect(slug).toBe('test-debate');
  });

  it('persists the scorecard under scorecard:<slug>', async () => {
    const kv = new FakeKV();
    await saveScorecard(kv as unknown as KVNamespace, MIN_SCORECARD);
    const raw = await kv.get('scorecard:test-debate');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.slug).toBe('test-debate');
    expect(parsed.question).toBe(MIN_SCORECARD.question);
  });

  it('rejects a scorecard that fails schema validation', async () => {
    const kv = new FakeKV() as unknown as KVNamespace;
    const bad = { slug: 'bad', question: '' } as unknown as Scorecard;
    await expect(saveScorecard(kv, bad)).rejects.toThrow(/Invalid scorecard/);
  });

  it('rejects a scorecard with fewer than 2 positions', async () => {
    const kv = new FakeKV() as unknown as KVNamespace;
    const bad: Scorecard = { ...MIN_SCORECARD, positions: [MIN_SCORECARD.positions[0]!] };
    await expect(saveScorecard(kv, bad)).rejects.toThrow(/Invalid scorecard/);
  });

  it('rejects a scorecard with an invalid publishedDate format', async () => {
    const kv = new FakeKV() as unknown as KVNamespace;
    const bad: Scorecard = { ...MIN_SCORECARD, publishedDate: 'January 2026' };
    await expect(saveScorecard(kv, bad)).rejects.toThrow(/Invalid scorecard/);
  });
});

// ---------------------------------------------------------------------------
// getScorecard
// ---------------------------------------------------------------------------

describe('getScorecard', () => {
  let kv: KVNamespace;

  beforeEach(async () => {
    kv = new FakeKV() as unknown as KVNamespace;
    await saveScorecard(kv, SECOND_SCORECARD);
  });

  it('returns the KV copy when the slug is present in KV', async () => {
    const result = await getScorecard(kv, 'second-debate');
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('second-debate');
    expect(result!.question).toBe(SECOND_SCORECARD.question);
  });

  it('falls back to the hardcoded scorecard when slug is absent from KV', async () => {
    // 'smartphone-ban-schools' is the slug of the hardcoded scorecard in src/data/scorecards.ts
    const result = await getScorecard(kv, 'smartphone-ban-schools');
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('smartphone-ban-schools');
  });

  it('returns null when the slug is absent from both KV and fallback', async () => {
    const result = await getScorecard(kv, 'does-not-exist');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listScorecards
// ---------------------------------------------------------------------------

describe('listScorecards', () => {
  it('returns the fallback scorecard when KV is empty', async () => {
    const kv = new FakeKV() as unknown as KVNamespace;
    const list = await listScorecards(kv);
    expect(list.length).toBeGreaterThanOrEqual(1);
    const slugs = list.map(sc => sc.slug);
    expect(slugs).toContain('smartphone-ban-schools');
  });

  it('merges KV and fallback scorecards', async () => {
    const kv = new FakeKV() as unknown as KVNamespace;
    await saveScorecard(kv, SECOND_SCORECARD);
    const list = await listScorecards(kv);
    const slugs = list.map(sc => sc.slug);
    expect(slugs).toContain('second-debate');        // from KV
    expect(slugs).toContain('smartphone-ban-schools'); // from fallback
  });

  it('KV version wins when slug collides with fallback', async () => {
    const kv = new FakeKV() as unknown as KVNamespace;
    // Override the fallback scorecard's question via KV
    const override: Scorecard = {
      ...MIN_SCORECARD,
      slug:     'smartphone-ban-schools',
      question: 'KV version of the debate',
      dek:      'This KV version should win.',
    };
    await saveScorecard(kv, override);
    const list = await listScorecards(kv);
    const found = list.find(sc => sc.slug === 'smartphone-ban-schools');
    expect(found).toBeDefined();
    expect(found!.question).toBe('KV version of the debate');
    // The slug should appear only once
    expect(list.filter(sc => sc.slug === 'smartphone-ban-schools')).toHaveLength(1);
  });

  it('sorts by publishedDate descending', async () => {
    const kv = new FakeKV() as unknown as KVNamespace;
    // SECOND_SCORECARD has publishedDate 2026-03-20 (newer than the fallback 2026-05-23)
    // Actually let's add one with an old date too
    await saveScorecard(kv, SECOND_SCORECARD);           // 2026-03-20
    await saveScorecard(kv, { ...MIN_SCORECARD, slug: 'old-debate', question: 'Old debate?', dek: 'Old.', publishedDate: '2025-01-01' });

    const list = await listScorecards(kv);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.publishedDate >= list[i]!.publishedDate).toBe(true);
    }
  });
});
