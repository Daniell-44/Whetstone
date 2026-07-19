import { describe, it, expect } from 'vitest';
import type { DocumentDb, Document, DocumentVersion } from '../../functions/_lib/documents/types';
import { handleReAudit, type ReAuditDeps } from '../../functions/_lib/documents/re-audit';
import type { LlmProvider } from '../../functions/_lib/providers/types';
import type { RateLimitKV } from '../../functions/_lib/rate-limit';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function makeFakeDb(): DocumentDb & { docs: Map<string, Document>; versions: Map<string, DocumentVersion> } {
  const docs     = new Map<string, Document>();
  const versions = new Map<string, DocumentVersion>();

  const db: DocumentDb = {
    createDocument: async (id, userId, title, workspaceId?, kind?) => {
      const now = Date.now();
      docs.set(id, { id, user_id: userId, workspace_id: workspaceId ?? null, title, status: 'active', kind: kind ?? 'draft', created_at: now, updated_at: now });
    },
    getDocumentById:                 async (id) => docs.get(id) ?? null,
    getActiveDocumentForUser:        async () => null,
    listActiveDocumentsForUser:      async () => [],
    listActiveDocumentsForWorkspace: async () => [],
    updateDocumentTitle:             async () => {},
    archiveDocument:                 async () => {},
    countActiveDocumentsForUser:     async () => 0,
    createVersion: async (id, documentId, content, versionNumber) => {
      versions.set(id, { id, document_id: documentId, content, version_number: versionNumber, audit_result: null, counterarg_result: null, extraction_json: null, commitments_json: null, citation_audit_json: null, result_json: null, created_at: Date.now() });
    },
    getLatestVersion: async (documentId) =>
      [...versions.values()].filter(v => v.document_id === documentId).sort((a, b) => b.version_number - a.version_number)[0] ?? null,
    getVersion:   async (versionId) => versions.get(versionId) ?? null,
    listVersions: async (documentId) =>
      [...versions.values()].filter(v => v.document_id === documentId).sort((a, b) => b.version_number - a.version_number),
    countVersionsForDocument: async (documentId) =>
      [...versions.values()].filter(v => v.document_id === documentId).length,
    storeAuditResultOnVersion: async (versionId, auditResult) => {
      const v = versions.get(versionId); if (v) versions.set(versionId, { ...v, audit_result: auditResult });
    },
    storeCounterargResultOnVersion: async () => {},
    storeExtractionOnVersion:       async () => {},
    storeCommitmentsOnVersion:      async () => {},
    storeCitationAuditOnVersion:    async () => {},
    storeResultJsonOnVersion: async (versionId, resultJson) => {
      const v = versions.get(versionId); if (v) versions.set(versionId, { ...v, result_json: resultJson });
    },
  };

  return Object.assign(db, { docs, versions });
}

function makeFakeKv(): RateLimitKV & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => { store.set(key, value); },
  };
}

// The engine drops findings whose quote is not verbatim in the audited text,
// so the draft content below must contain this exact quote.
const DRAFT_CONTENT = 'He is biased so ignore him. That is the whole case they make, and it never engages the substance of the argument.';

const AUDIT_WITH_ONE_FALLACY = JSON.stringify({
  centralClaim:   'Test claim',
  toulmin:        { claim: 'c', grounds: 'g', statedWarrant: null, unstatedWarrants: [], weakestLink: 'w' },
  namedFallacies: [{ name: 'Ad Hominem', quote: 'He is biased so ignore him', explanation: 'e', severity: 'high', confidence: 90 }],
  loadedLanguage: [],
  notes:          null,
});

function makeProvider(content = AUDIT_WITH_ONE_FALLACY): LlmProvider {
  return { name: 'fake', complete: async () => ({ content, inputTokens: 5, outputTokens: 3 }) };
}

function makeDeps(db: DocumentDb, overrides?: Partial<ReAuditDeps>): ReAuditDeps {
  let counter = 0;
  return {
    db,
    provider:          makeProvider(),
    geminiApiKey:      'test-key',
    rateLimitKv:       undefined,
    getSession:        async () => ({ userId: 'user-1' }),
    checkSubscription: async () => true,
    newId:             () => `id-${++counter}`,
    ...overrides,
  };
}

function req(): Request {
  return new Request('https://test.example/api/documents/doc-1/re-audit', { method: 'POST' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rj(res: Response): Promise<any> { return res.json(); }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleReAudit', () => {
  it('rejects unauthenticated requests', async () => {
    const db  = makeFakeDb();
    const res = await handleReAudit(req(), 'doc-1', makeDeps(db, { getSession: async () => null }));
    expect(res.status).toBe(401);
  });

  it('404s a document owned by someone else', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-other', 'Draft');
    const res = await handleReAudit(req(), 'doc-1', makeDeps(db));
    expect(res.status).toBe(404);
  });

  it('rejects non-draft documents', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Saved run', undefined, 'transcript');
    await db.createVersion('v1', 'doc-1', 'content', 1);
    const res  = await handleReAudit(req(), 'doc-1', makeDeps(db));
    const body = await rj(res);
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  it('creates a new audited version and reports the whole first audit as new findings', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', DRAFT_CONTENT, 1);

    const res  = await handleReAudit(req(), 'doc-1', makeDeps(db));
    const body = await rj(res);

    expect(body.ok).toBe(true);
    expect(body.versionNumber).toBe(2);
    expect(body.hadPreviousAudit).toBe(false);
    expect(body.delta).toEqual({ newFindings: 1, resolved: 0 });

    const latest = await db.getLatestVersion('doc-1');
    expect(latest?.version_number).toBe(2);
    expect(latest?.content).toBe(DRAFT_CONTENT);
    expect(latest?.audit_result).not.toBeNull();
  });

  it('computes the delta against the previous audited version', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', DRAFT_CONTENT, 1);
    // Previous audit had a different fallacy: it should count as resolved.
    await db.storeAuditResultOnVersion('v1', JSON.stringify({
      centralClaim:   'Old claim',
      toulmin:        { claim: 'c', grounds: 'g', statedWarrant: null, unstatedWarrants: [], weakestLink: 'w' },
      namedFallacies: [{ name: 'Straw Man', quote: 'They want to ban everything outright', explanation: 'e', severity: 'medium', groundedness: { kind: 'structural' } }],
      loadedLanguage: [],
      notes:          null,
    }));

    const res  = await handleReAudit(req(), 'doc-1', makeDeps(db));
    const body = await rj(res);

    expect(body.ok).toBe(true);
    expect(body.hadPreviousAudit).toBe(true);
    expect(body.delta).toEqual({ newFindings: 1, resolved: 1 });
  });

  it('consumes one audit from the shared quota bucket and refuses when exhausted', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', DRAFT_CONTENT, 1);
    const kv = makeFakeKv();

    // Free signed-in tier: 5 per day. Pre-fill the same key /api/audit uses.
    const dayKey = `audit:user:user-1:day`;
    await kv.put(dayKey, JSON.stringify({ count: 5, period: new Date().toISOString().slice(0, 10) }));

    const deps = makeDeps(db, { rateLimitKv: kv, checkSubscription: async () => false });
    const res  = await handleReAudit(req(), 'doc-1', deps);
    const body = await rj(res);

    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
    // No new version was created on a refused run.
    expect(await db.countVersionsForDocument('doc-1')).toBe(1);
  });

  it('404s when the document has no versions', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    const res = await handleReAudit(req(), 'doc-1', makeDeps(db));
    expect(res.status).toBe(404);
  });
});
