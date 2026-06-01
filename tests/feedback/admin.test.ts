import { describe, it, expect } from 'vitest';
import type { FeedbackDb, FeedbackFilters } from '../../functions/_lib/feedback/db';
import type { FeedbackRow, FeedbackSummary } from '../../functions/_lib/feedback/types';
import { handleAdminFeedback, type AdminFeedbackDeps } from '../../functions/_lib/feedback/handler';

// ---------------------------------------------------------------------------
// Fake FeedbackDb
// ---------------------------------------------------------------------------

function makeFakeDb(overrides: Partial<FeedbackDb> = {}): FeedbackDb & { rows: FeedbackRow[] } {
  const rows: FeedbackRow[] = [];

  const db: FeedbackDb = {
    async recordFeedback() {},

    async listFeedbackSince(sinceMs: number, filters: FeedbackFilters = {}) {
      return rows.filter(r => {
        if (r.created_at < sinceMs) return false;
        if (filters.lens && r.target_lens !== filters.lens) return false;
        if (filters.type && r.feedback_type !== filters.type) return false;
        return true;
      });
    },

    async summariseFeedback(sinceMs: number, filters: FeedbackFilters = {}): Promise<FeedbackSummary> {
      let thumbsUp = 0, thumbsDown = 0;
      const visible = rows.filter(r => {
        if (r.created_at < sinceMs) return false;
        if (filters.lens && r.target_lens !== filters.lens) return false;
        if (filters.type && r.feedback_type !== filters.type) return false;
        return true;
      });
      for (const r of visible) {
        if (r.feedback_type === 'finding_thumbs_up')   thumbsUp++;
        if (r.feedback_type === 'finding_thumbs_down') thumbsDown++;
      }
      return {
        ok: true,
        period: { since: new Date(sinceMs).toISOString(), until: new Date().toISOString() },
        totals: { thumbsUp, thumbsDown, auditRatings: 0, bugReports: 0 },
        byLens: {
          namedFallacies:   { up: thumbsUp, down: thumbsDown, downRate: thumbsUp + thumbsDown > 0 ? thumbsDown / (thumbsUp + thumbsDown) : 0 },
          loadedLanguage:   { up: 0, down: 0, downRate: 0 },
          unstatedWarrants: { up: 0, down: 0, downRate: 0 },
          counterarguments: { up: 0, down: 0, downRate: 0 },
        },
        qualitativeReasons: visible
          .filter(r => r.qualitative)
          .map(r => ({
            lens:            r.target_lens,
            type:            r.feedback_type,
            text:            r.qualitative!,
            createdAt:       new Date(r.created_at).toISOString(),
            findingSnapshot: r.finding_snapshot ? JSON.parse(r.finding_snapshot) : null,
          })),
      };
    },

    ...overrides,
  };

  return Object.assign(db, { rows });
}

function seedRow(db: ReturnType<typeof makeFakeDb>, partial: Partial<FeedbackRow> = {}): void {
  db.rows.push({
    id: `r-${db.rows.length}`,
    user_id: 'user-1',
    document_id: 'doc-1',
    version_id: null,
    feedback_type: 'finding_thumbs_down',
    target_lens: 'namedFallacies',
    match_key: 'Ad Hominem:foo',
    finding_snapshot: JSON.stringify({ name: 'Ad Hominem' }),
    rating: null,
    qualitative: 'Not a real fallacy here',
    created_at: Date.now(),
    ...partial,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = 'test-secret-abc';

function getReq(params: Record<string, string> = {}, secret = SECRET): Request {
  const url = new URL('https://test.example/api/admin/feedback');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString(), {
    method: 'GET',
    headers: { 'X-Analyser-Secret': secret },
  });
}

function makeDeps(db: FeedbackDb, adminSecret: string | undefined = SECRET): AdminFeedbackDeps {
  return { db, adminSecret };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('handleAdminFeedback — auth', () => {
  it('returns 401 with no secret header', async () => {
    const db  = makeFakeDb();
    const req = new Request('https://test.example/api/admin/feedback?since=30d', { method: 'GET' });
    const res = await handleAdminFeedback(req, makeDeps(db, SECRET));
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const db  = makeFakeDb();
    const res = await handleAdminFeedback(getReq({ since: '30d' }, 'wrong'), makeDeps(db, SECRET));
    expect(res.status).toBe(401);
  });

  it('returns 401 when adminSecret is not configured', async () => {
    const db  = makeFakeDb();
    const res = await handleAdminFeedback(getReq({ since: '30d' }), { db, adminSecret: undefined });
    expect(res.status).toBe(401);
  });

  it('rejects non-GET method', async () => {
    const db  = makeFakeDb();
    const req = new Request('https://test.example/api/admin/feedback?since=30d', {
      method: 'POST',
      headers: { 'X-Analyser-Secret': SECRET },
    });
    const res = await handleAdminFeedback(req, makeDeps(db, SECRET));
    expect(res.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// since parameter
// ---------------------------------------------------------------------------

describe('handleAdminFeedback — since parameter', () => {
  it('requires since parameter', async () => {
    const db  = makeFakeDb();
    const res = await handleAdminFeedback(getReq(), makeDeps(db, SECRET));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/since/);
  });

  it('rejects invalid since value', async () => {
    const db  = makeFakeDb();
    const res = await handleAdminFeedback(getReq({ since: 'not-a-date' }), makeDeps(db, SECRET));
    expect(res.status).toBe(400);
  });

  it('accepts "7d" relative shorthand', async () => {
    const db  = makeFakeDb();
    const res = await handleAdminFeedback(getReq({ since: '7d' }), makeDeps(db, SECRET));
    expect(res.status).toBe(200);
  });

  it('accepts "30d" relative shorthand', async () => {
    const db  = makeFakeDb();
    const res = await handleAdminFeedback(getReq({ since: '30d' }), makeDeps(db, SECRET));
    expect(res.status).toBe(200);
  });

  it('accepts ISO date string', async () => {
    const db  = makeFakeDb();
    const res = await handleAdminFeedback(getReq({ since: '2026-01-01' }), makeDeps(db, SECRET));
    expect(res.status).toBe(200);
  });

  it('date filter excludes rows older than since', async () => {
    const db = makeFakeDb();
    // Row 7 days ago
    seedRow(db, { created_at: Date.now() - 7 * 24 * 60 * 60 * 1000 - 1000 });
    // Row now
    seedRow(db, { created_at: Date.now() });

    const res  = await handleAdminFeedback(getReq({ since: '3d', format: 'json' }), makeDeps(db, SECRET));
    const body = await res.json() as { count: number };
    expect(body.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Summary format
// ---------------------------------------------------------------------------

describe('handleAdminFeedback — summary format', () => {
  it('returns summary shape by default', async () => {
    const db  = makeFakeDb();
    seedRow(db, { feedback_type: 'finding_thumbs_up', qualitative: null });
    seedRow(db, { feedback_type: 'finding_thumbs_down', qualitative: 'Not a fallacy.' });

    const res  = await handleAdminFeedback(getReq({ since: '7d' }), makeDeps(db, SECRET));
    expect(res.status).toBe(200);
    const body = await res.json() as FeedbackSummary;
    expect(body.ok).toBe(true);
    expect(body.totals.thumbsUp).toBe(1);
    expect(body.totals.thumbsDown).toBe(1);
    expect(body.qualitativeReasons).toHaveLength(1);
    expect(body.qualitativeReasons[0].text).toBe('Not a fallacy.');
    expect(body.byLens).toBeDefined();
    expect(body.period.since).toBeDefined();
    expect(body.period.until).toBeDefined();
  });

  it('returns full rows when format=json', async () => {
    const db  = makeFakeDb();
    seedRow(db);

    const res  = await handleAdminFeedback(getReq({ since: '7d', format: 'json' }), makeDeps(db, SECRET));
    const body = await res.json() as { ok: boolean; count: number; rows: FeedbackRow[] };
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows[0].feedback_type).toBe('finding_thumbs_down');
  });
});

// ---------------------------------------------------------------------------
// Filter parameters
// ---------------------------------------------------------------------------

describe('handleAdminFeedback — filters', () => {
  it('filters by lens', async () => {
    const db = makeFakeDb();
    seedRow(db, { target_lens: 'namedFallacies' });
    seedRow(db, { target_lens: 'loadedLanguage' });

    const res  = await handleAdminFeedback(getReq({ since: '7d', lens: 'namedFallacies', format: 'json' }), makeDeps(db, SECRET));
    const body = await res.json() as { count: number };
    expect(body.count).toBe(1);
  });

  it('filters by type', async () => {
    const db = makeFakeDb();
    seedRow(db, { feedback_type: 'finding_thumbs_up' });
    seedRow(db, { feedback_type: 'finding_thumbs_down' });

    const res  = await handleAdminFeedback(getReq({ since: '7d', type: 'finding_thumbs_up', format: 'json' }), makeDeps(db, SECRET));
    const body = await res.json() as { count: number };
    expect(body.count).toBe(1);
  });
});
