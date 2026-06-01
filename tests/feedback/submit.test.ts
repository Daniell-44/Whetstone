import { describe, it, expect, beforeEach } from 'vitest';
import type { FeedbackDb, FeedbackFilters } from '../../functions/_lib/feedback/db';
import type { FeedbackRow, FeedbackSubmission, FeedbackSummary } from '../../functions/_lib/feedback/types';
import { handleSubmitFeedback, type SubmitFeedbackDeps } from '../../functions/_lib/feedback/handler';
import type { RateLimitKV } from '../../functions/_lib/rate-limit';

// ---------------------------------------------------------------------------
// Fake FeedbackDb
// ---------------------------------------------------------------------------

function makeFakeDb(): FeedbackDb & { rows: FeedbackRow[] } {
  const rows: FeedbackRow[] = [];

  const db: FeedbackDb = {
    async recordFeedback({ id, userId, feedbackType, documentId, versionId, targetLens, matchKey, findingSnapshot, rating, qualitative }) {
      rows.push({
        id,
        user_id:          userId,
        document_id:      documentId ?? null,
        version_id:       versionId  ?? null,
        feedback_type:    feedbackType,
        target_lens:      targetLens ?? null,
        match_key:        matchKey   ?? null,
        finding_snapshot: findingSnapshot != null ? JSON.stringify(findingSnapshot) : null,
        rating:           rating     ?? null,
        qualitative:      qualitative ?? null,
        created_at:       Date.now(),
      });
    },
    async listFeedbackSince(sinceMs, filters: FeedbackFilters = {}) {
      return rows.filter(r => {
        if (r.created_at < sinceMs) return false;
        if (filters.lens && r.target_lens !== filters.lens) return false;
        if (filters.type && r.feedback_type !== filters.type) return false;
        return true;
      });
    },
    async summariseFeedback(): Promise<FeedbackSummary> {
      return {
        ok: true,
        period: { since: new Date().toISOString(), until: new Date().toISOString() },
        totals: { thumbsUp: 0, thumbsDown: 0, auditRatings: 0, bugReports: 0 },
        byLens: {
          namedFallacies:   { up: 0, down: 0, downRate: 0 },
          loadedLanguage:   { up: 0, down: 0, downRate: 0 },
          unstatedWarrants: { up: 0, down: 0, downRate: 0 },
          counterarguments: { up: 0, down: 0, downRate: 0 },
        },
        qualitativeReasons: [],
      };
    },
  };

  return Object.assign(db, { rows });
}

// ---------------------------------------------------------------------------
// Fake KV for rate limiting
// ---------------------------------------------------------------------------

function makeFakeKv(): RateLimitKV & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return Object.assign(
    {
      async get(key: string) { return store.get(key) ?? null; },
      async put(key: string, value: string) { store.set(key, value); },
    },
    { store },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
function newId() { return `fb-${++idCounter}`; }

function postReq(body: unknown): Request {
  return new Request('https://test.example/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SESSION_USER = 'user-1';
const DOC_ID       = 'doc-abc';

const VALID_THUMBS_UP = {
  feedbackType:    'finding_thumbs_up',
  documentId:      DOC_ID,
  targetLens:      'namedFallacies',
  matchKey:        'Ad Hominem:foo bar',
  findingSnapshot: { name: 'Ad Hominem', quote: 'foo bar' },
};

function makeDeps(db: FeedbackDb, opts: {
  authed?: boolean;
  kv?: RateLimitKV;
  cap?: number;
  ownsDoc?: boolean;
} = {}): SubmitFeedbackDeps {
  const { authed = true, kv, cap = 60, ownsDoc = true } = opts;
  return {
    db,
    rateLimitKv:        kv,
    feedbackDailyCap:   cap,
    newId,
    getSession:         async () => authed ? { userId: SESSION_USER } : null,
    getDocumentOwnerId: async () => ownsDoc ? SESSION_USER : null,
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('handleSubmitFeedback — auth', () => {
  it('returns 401 when not authenticated', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(postReq(VALID_THUMBS_UP), makeDeps(db, { authed: false }));
    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('rejects non-POST method', async () => {
    const db  = makeFakeDb();
    const req = new Request('https://test.example/api/feedback', { method: 'GET' });
    const res = await handleSubmitFeedback(req, makeDeps(db));
    expect(res.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('handleSubmitFeedback — validation', () => {
  it('rejects invalid JSON', async () => {
    const db  = makeFakeDb();
    const req = new Request('https://test.example/api/feedback', { method: 'POST', body: 'bad' });
    const res = await handleSubmitFeedback(req, makeDeps(db));
    expect(res.status).toBe(400);
  });

  it('rejects unknown feedbackType', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq({ ...VALID_THUMBS_UP, feedbackType: 'something_else' }),
      makeDeps(db),
    );
    expect(res.status).toBe(400);
  });

  it('rejects finding feedback without targetLens', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq({ feedbackType: 'finding_thumbs_up', documentId: DOC_ID, matchKey: 'k', findingSnapshot: {} }),
      makeDeps(db),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/targetLens/);
  });

  it('rejects finding feedback without matchKey', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq({ feedbackType: 'finding_thumbs_down', documentId: DOC_ID, targetLens: 'namedFallacies', findingSnapshot: {} }),
      makeDeps(db),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/matchKey/);
  });

  it('rejects finding feedback without findingSnapshot', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq({ feedbackType: 'finding_thumbs_up', documentId: DOC_ID, targetLens: 'namedFallacies', matchKey: 'k' }),
      makeDeps(db),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/findingSnapshot/);
  });

  it('rejects audit_rating without rating', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq({ feedbackType: 'audit_rating', documentId: DOC_ID }),
      makeDeps(db),
    );
    expect(res.status).toBe(400);
  });

  it('rejects qualitative longer than 500 chars', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq({ ...VALID_THUMBS_UP, qualitative: 'x'.repeat(501) }),
      makeDeps(db),
    );
    expect(res.status).toBe(400);
  });

  it('rejects document not owned by user', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq(VALID_THUMBS_UP),
      makeDeps(db, { ownsDoc: false }),
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Success
// ---------------------------------------------------------------------------

describe('handleSubmitFeedback — success', () => {
  it('records a thumbs-up and returns ok', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(postReq(VALID_THUMBS_UP), makeDeps(db));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].feedback_type).toBe('finding_thumbs_up');
    expect(db.rows[0].target_lens).toBe('namedFallacies');
    expect(db.rows[0].match_key).toBe('Ad Hominem:foo bar');
  });

  it('records a thumbs-down with qualitative reason', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq({ ...VALID_THUMBS_UP, feedbackType: 'finding_thumbs_down', qualitative: 'This is noise, not a real fallacy.' }),
      makeDeps(db),
    );
    expect(res.status).toBe(200);
    expect(db.rows[0].feedback_type).toBe('finding_thumbs_down');
    expect(db.rows[0].qualitative).toBe('This is noise, not a real fallacy.');
  });

  it('records a bug report without document context', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(
      postReq({ feedbackType: 'bug_report', qualitative: 'Page crashed on submit.' }),
      makeDeps(db),
    );
    expect(res.status).toBe(200);
    expect(db.rows[0].document_id).toBeNull();
  });

  it('stores findingSnapshot as JSON', async () => {
    const db       = makeFakeDb();
    const snapshot = { name: 'Ad Hominem', quote: 'foo bar', severity: 'high', confidence: 90 };
    await handleSubmitFeedback(
      postReq({ ...VALID_THUMBS_UP, findingSnapshot: snapshot }),
      makeDeps(db),
    );
    const stored = JSON.parse(db.rows[0].finding_snapshot!);
    expect(stored).toEqual(snapshot);
  });

  it('accepts all four lens values', async () => {
    const lenses = ['namedFallacies', 'loadedLanguage', 'unstatedWarrants', 'counterarguments'] as const;
    for (const lens of lenses) {
      const db  = makeFakeDb();
      const res = await handleSubmitFeedback(
        postReq({ ...VALID_THUMBS_UP, targetLens: lens }),
        makeDeps(db),
      );
      expect(res.status).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('handleSubmitFeedback — rate limiting', () => {
  it('allows up to cap requests per day', async () => {
    const db  = makeFakeDb();
    const kv  = makeFakeKv();

    for (let i = 0; i < 3; i++) {
      const res = await handleSubmitFeedback(postReq(VALID_THUMBS_UP), makeDeps(db, { kv, cap: 3 }));
      expect(res.status).toBe(200);
    }
  });

  it('blocks when cap is exceeded', async () => {
    const db  = makeFakeDb();
    const kv  = makeFakeKv();

    for (let i = 0; i < 2; i++) {
      await handleSubmitFeedback(postReq(VALID_THUMBS_UP), makeDeps(db, { kv, cap: 2 }));
    }

    const res = await handleSubmitFeedback(postReq(VALID_THUMBS_UP), makeDeps(db, { kv, cap: 2 }));
    expect(res.status).toBe(429);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('skips rate limit when kv is not configured', async () => {
    const db  = makeFakeDb();
    const res = await handleSubmitFeedback(postReq(VALID_THUMBS_UP), makeDeps(db, { kv: undefined }));
    expect(res.status).toBe(200);
  });
});
