import { describe, it, expect } from 'vitest';
import type { DocumentDb, Document, DocumentVersion } from '../../functions/_lib/documents/types';
import {
  handleCreateDocument,
  handleCreateVersion,
  handleVersionAudit,
  handleVersionCounterarg,
  handleVersionCommitments,
  handleRestoreVersion,
  type CreateDocumentDeps,
  type CreateVersionDeps,
  type VersionAuditDeps,
  type VersionCounterargDeps,
  type VersionCommitmentsDeps,
  type RestoreVersionDeps,
} from '../../functions/_lib/documents/handlers';
import type { LlmProvider } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Fake DocumentDb
// ---------------------------------------------------------------------------

function makeFakeDb(): DocumentDb & { docs: Map<string, Document>; versions: Map<string, DocumentVersion> } {
  const docs     = new Map<string, Document>();
  const versions = new Map<string, DocumentVersion>();

  const db: DocumentDb = {
    createDocument: async (id, userId, title, workspaceId?) => {
      const now = Date.now();
      docs.set(id, { id, user_id: userId, workspace_id: workspaceId ?? null, title, status: 'active', created_at: now, updated_at: now });
    },
    getDocumentById:         async (id) => docs.get(id) ?? null,
    getActiveDocumentForUser: async (userId) => [...docs.values()].find(d => d.user_id === userId && d.status === 'active') ?? null,
    listActiveDocumentsForUser: async (userId) => [...docs.values()].filter(d => d.user_id === userId && d.status === 'active'),
    listActiveDocumentsForWorkspace: async (workspaceId) => [...docs.values()].filter(d => d.workspace_id === workspaceId && d.status === 'active'),
    updateDocumentTitle: async (id, title) => { const d = docs.get(id); if (d) docs.set(id, { ...d, title }); },
    archiveDocument: async (id) => { const d = docs.get(id); if (d) docs.set(id, { ...d, status: 'archived' }); },
    countActiveDocumentsForUser: async (userId) => [...docs.values()].filter(d => d.user_id === userId && d.status === 'active').length,
    createVersion: async (id, documentId, content, versionNumber) => {
      const now = Date.now();
      versions.set(id, { id, document_id: documentId, content, version_number: versionNumber, audit_result: null, counterarg_result: null, extraction_json: null, commitments_json: null, citation_audit_json: null, created_at: now });
    },
    getLatestVersion: async (documentId) => {
      return [...versions.values()].filter(v => v.document_id === documentId).sort((a, b) => b.version_number - a.version_number)[0] ?? null;
    },
    getVersion: async (versionId) => versions.get(versionId) ?? null,
    listVersions: async (documentId) => [...versions.values()].filter(v => v.document_id === documentId),
    storeAuditResultOnVersion: async (versionId, auditResult) => {
      const v = versions.get(versionId); if (v) versions.set(versionId, { ...v, audit_result: auditResult });
    },
    storeCounterargResultOnVersion: async (versionId, counterargResult) => {
      const v = versions.get(versionId); if (v) versions.set(versionId, { ...v, counterarg_result: counterargResult });
    },
    storeExtractionOnVersion: async (versionId, extractionJson) => {
      const v = versions.get(versionId); if (v) versions.set(versionId, { ...v, extraction_json: extractionJson });
    },
    storeCommitmentsOnVersion: async (versionId, commitmentsJson) => {
      const v = versions.get(versionId); if (v) versions.set(versionId, { ...v, commitments_json: commitmentsJson });
    },
    storeCitationAuditOnVersion: async (versionId, citationAuditJson) => {
      const v = versions.get(versionId); if (v) versions.set(versionId, { ...v, citation_audit_json: citationAuditJson });
    },
    countVersionsForDocument: async (documentId) =>
      [...versions.values()].filter(v => v.document_id === documentId).length,
  };

  return Object.assign(db, { docs, versions });
}

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('https://test.example/api/documents', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rj(res: Response): Promise<any> { return res.json(); }

const MINIMAL_AUDIT_JSON = JSON.stringify({
  centralClaim:   'Test claim',
  toulmin:        { claim: 'Test claim', grounds: 'Test grounds', statedWarrant: null, unstatedWarrants: [], weakestLink: 'The weakest link' },
  namedFallacies: [],
  loadedLanguage: [],
  notes:          null,
});

const MINIMAL_COUNTERARG_JSON = JSON.stringify({
  centralClaim:     'Test central claim',
  counterarguments: [
    { position: 'Position one', strongestCase: { claim: 'c1', grounds: 'g1', warrant: 'w1' }, missedByDraft: 'm1', why: 'y1' },
    { position: 'Position two', strongestCase: { claim: 'c2', grounds: 'g2', warrant: 'w2' }, missedByDraft: 'm2', why: 'y2' },
  ],
  notes: null,
});

const MINIMAL_COMMITMENTS_JSON = JSON.stringify({
  ethical:         { framework: 'consequentialist', evidence: 'e1', explanation: 'ex1', confidence: 75 },
  epistemic:       { framework: 'empiricist',        evidence: 'e2', explanation: 'ex2', confidence: 80 },
  political:       null,
  methodological:  null,
  alternativePerspectives: [
    { framework: 'Deontological', frameworkType: 'ethical', objection: 'obj1', specificity: 'sp1' },
  ],
  notes: null,
});

function makeAuditProvider(): LlmProvider {
  return { name: 'fake-audit', complete: async () => ({ content: MINIMAL_AUDIT_JSON, inputTokens: 5, outputTokens: 3 }) };
}

function makeCounterargProvider(): LlmProvider {
  return { name: 'fake-counterarg', complete: async () => ({ content: MINIMAL_COUNTERARG_JSON, inputTokens: 5, outputTokens: 3 }) };
}

function makeCommitmentsProvider(): LlmProvider {
  return { name: 'fake-commitments', complete: async () => ({ content: MINIMAL_COMMITMENTS_JSON, inputTokens: 5, outputTokens: 3 }) };
}

// ---------------------------------------------------------------------------
// handleCreateDocument
// ---------------------------------------------------------------------------

describe('handleCreateDocument', () => {
  function makeDeps(db: ReturnType<typeof makeFakeDb>, overrides?: Partial<CreateDocumentDeps>): CreateDocumentDeps {
    let counter = 0;
    return {
      db,
      getSession:        async () => ({ userId: 'user-1' }),
      newId:             () => `id-${++counter}`,
      ...overrides,
    };
  }

  it('creates a document and first version, returns 200 with docId and versionId', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db);
    const req  = makeRequest({ title: 'My essay', content: 'x'.repeat(50) });
    const res  = await handleCreateDocument(req, deps);
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.docId).toBeDefined();
    expect(data.versionId).toBeDefined();
    expect(db.docs.size).toBe(1);
    expect(db.versions.size).toBe(1);
  });

  it('returns 401 when not authenticated', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db, { getSession: async () => null });
    const res  = await handleCreateDocument(makeRequest({ content: 'x'.repeat(50) }), deps);
    expect(res.status).toBe(401);
  });

  it('returns 400 for content shorter than 50 characters', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db);
    const res  = await handleCreateDocument(makeRequest({ content: 'short' }), deps);
    expect(res.status).toBe(400);
    expect((await rj(res)).error.code).toBe('INVALID_INPUT');
  });

  it('keeps the first document active when a second is created', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db);

    await handleCreateDocument(makeRequest({ content: 'x'.repeat(50) }), deps);
    expect(db.docs.size).toBe(1);
    const firstId = [...db.docs.keys()][0]!;

    await handleCreateDocument(makeRequest({ content: 'y'.repeat(50) }), deps);
    expect(db.docs.size).toBe(2);
    expect(db.docs.get(firstId)?.status).toBe('active');
  });

  it('allows multiple active documents on any account', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db);

    await handleCreateDocument(makeRequest({ content: 'x'.repeat(50) }), deps);
    await handleCreateDocument(makeRequest({ content: 'y'.repeat(50) }), deps);

    const activeDocs = [...db.docs.values()].filter(d => d.status === 'active');
    expect(activeDocs).toHaveLength(2);
  });

  it('uses the provided title', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db);
    await handleCreateDocument(makeRequest({ title: 'Custom title', content: 'x'.repeat(50) }), deps);
    const doc = [...db.docs.values()][0];
    expect(doc?.title).toBe('Custom title');
  });
});

// ---------------------------------------------------------------------------
// handleCreateVersion
// ---------------------------------------------------------------------------

describe('handleCreateVersion', () => {
  function makeDeps(db: ReturnType<typeof makeFakeDb>, overrides?: Partial<CreateVersionDeps>): CreateVersionDeps {
    let counter = 0;
    return {
      db,
      getSession: async () => ({ userId: 'user-1' }),
      newId:      () => `v-${++counter}`,
      ...overrides,
    };
  }

  it('creates a new version and returns 200', async () => {
    const db   = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db);
    const req  = makeRequest({ content: 'y'.repeat(50) });
    const res  = await handleCreateVersion(req, 'doc-1', deps);
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.versionNumber).toBe(2);
  });

  it('returns 404 when document belongs to a different user', async () => {
    const db   = makeFakeDb();
    await db.createDocument('doc-1', 'user-other', 'Draft');
    const deps = makeDeps(db);
    const res  = await handleCreateVersion(makeRequest({ content: 'y'.repeat(50) }), 'doc-1', deps);
    expect(res.status).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db, { getSession: async () => null });
    const res  = await handleCreateVersion(makeRequest({ content: 'y'.repeat(50) }), 'doc-1', deps);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// handleVersionAudit
// ---------------------------------------------------------------------------

class FakeKV {
  store = new Map<string, string>();
  async get(k: string) { return this.store.get(k) ?? null; }
  async put(k: string, v: string) { this.store.set(k, v); }
}

describe('handleVersionAudit', () => {
  function makeDeps(db: ReturnType<typeof makeFakeDb>, overrides?: Partial<VersionAuditDeps>): VersionAuditDeps {
    return {
      db,
      provider:     makeAuditProvider(),
      geminiApiKey: 'test-key',
      getSession:   async () => ({ userId: 'user-1' }),
      ...overrides,
    };
  }

  it('runs audit, stores result, and returns audit data', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db);
    const res  = await handleVersionAudit(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.audit).toBeDefined();
    expect(db.versions.get('v1')?.audit_result).toBeDefined();
  });

  // A saved-draft audit is the same audit and must spend the same allowance.
  // This path was gated on a subscription; when paid tiers were retired the
  // gate went and nothing replaced it, leaving signed-in writers an unmetered
  // route to the most expensive run in the product.
  it('spends the shared audit allowance', async () => {
    const kv = new FakeKV();
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db, { rateLimitKv: kv, freeUseAllowance: 1 });
    const req  = () => new Request('https://t.example', { method: 'POST' });

    expect((await rj(await handleVersionAudit(req(), 'doc-1', 'v1', deps))).ok).toBe(true);

    const blocked = await rj(await handleVersionAudit(req(), 'doc-1', 'v1', deps));
    expect(blocked.ok).toBe(false);
    expect(blocked.error.code).toBe('RATE_LIMITED');
    expect(Number.isNaN(Date.parse(blocked.error.resetAt))).toBe(false);
  });

  it('shares one allowance with /api/audit rather than holding its own', async () => {
    // Both paths key on `audit:<identity>`, so exhausting one exhausts the other.
    const kv = new FakeKV();
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db, { rateLimitKv: kv, freeUseAllowance: 1 });

    await handleVersionAudit(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    const stored = [...kv.store.keys()];
    expect(stored).toEqual(['audit:user:user-1']);
  });

  it('runs unmetered when no rate-limit store is bound', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db);  // no rateLimitKv — local dev
    for (let i = 0; i < 3; i++) {
      expect((await rj(await handleVersionAudit(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps))).ok).toBe(true);
    }
  });

  it('returns 401 when not authenticated', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db, { getSession: async () => null });
    const res  = await handleVersionAudit(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(401);
  });

  it('returns 404 when document belongs to another user', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-other', 'Draft');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db);
    const res  = await handleVersionAudit(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(404);
  });

  it('returns 404 when version belongs to a different document', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'D1');
    await db.createDocument('doc-2', 'user-1', 'D2');
    await db.createVersion('v1', 'doc-2', 'x'.repeat(50), 1);
    const deps = makeDeps(db);
    const res  = await handleVersionAudit(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(404);
  });

  it('returns 503 when geminiApiKey is not configured', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'D');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db, { geminiApiKey: undefined });
    const res  = await handleVersionAudit(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// handleVersionCounterarg
// ---------------------------------------------------------------------------

describe('handleVersionCounterarg', () => {
  function makeDeps(db: ReturnType<typeof makeFakeDb>, overrides?: Partial<VersionCounterargDeps>): VersionCounterargDeps {
    return {
      db,
      provider:          makeCounterargProvider(),
      geminiApiKey:      'test-key',
      getSession:        async () => ({ userId: 'user-1' }),
      ...overrides,
    };
  }

  it('runs counterarg, stores result, and returns data', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db);
    const res  = await handleVersionCounterarg(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.result).toBeDefined();
    expect(db.versions.get('v1')?.counterarg_result).toBeDefined();
  });

  it('returns 401 when not authenticated', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db, { getSession: async () => null });
    const res  = await handleVersionCounterarg(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(401);
  });

  it('does not gate on a subscription — it resolves the document instead', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db);
    const res  = await handleVersionCounterarg(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).not.toBe(402);
    // With no such document the caller gets a real 404, not a paywall.
    expect(res.status).toBe(404);
  });

  it('goes straight to the ownership check now that no paywall precedes it', async () => {
    let ownershipChecked = false;
    const db = makeFakeDb();
    const origGet = db.getDocumentById.bind(db);
    db.getDocumentById = async (id) => { ownershipChecked = true; return origGet(id); };
    const deps = makeDeps(db);
    await handleVersionCounterarg(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(ownershipChecked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleVersionCommitments
// ---------------------------------------------------------------------------

describe('handleVersionCommitments', () => {
  function makeDeps(db: ReturnType<typeof makeFakeDb>, overrides?: Partial<VersionCommitmentsDeps>): VersionCommitmentsDeps {
    return {
      db,
      provider:          makeCommitmentsProvider(),
      geminiApiKey:      'test-key',
      getSession:        async () => ({ userId: 'user-1' }),
      ...overrides,
    };
  }

  it('runs commitments, stores result, and returns data', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db);
    const res  = await handleVersionCommitments(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.result).toBeDefined();
    expect(db.versions.get('v1')?.commitments_json).toBeDefined();
  });

  it('returns 401 when not authenticated', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db, { getSession: async () => null });
    const res  = await handleVersionCommitments(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(401);
  });

  it('does not gate on a subscription — it resolves the document instead', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db);
    const res  = await handleVersionCommitments(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).not.toBe(402);
    // With no such document the caller gets a real 404, not a paywall.
    expect(res.status).toBe(404);
  });

  it('returns 503 when geminiApiKey is not configured', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'D');
    await db.createVersion('v1', 'doc-1', 'x'.repeat(50), 1);
    const deps = makeDeps(db, { geminiApiKey: undefined });
    const res  = await handleVersionCommitments(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(503);
  });

  it('returns 404 when version belongs to a different document', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'D1');
    await db.createDocument('doc-2', 'user-1', 'D2');
    await db.createVersion('v1', 'doc-2', 'x'.repeat(50), 1);
    const deps = makeDeps(db);
    const res  = await handleVersionCommitments(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// handleRestoreVersion
// ---------------------------------------------------------------------------

describe('handleRestoreVersion', () => {
  function makeDeps(db: ReturnType<typeof makeFakeDb>, overrides?: Partial<RestoreVersionDeps>): RestoreVersionDeps {
    let counter = 0;
    return {
      db,
      getSession: async () => ({ userId: 'user-1' }),
      newId:      () => `restored-${++counter}`,
      ...overrides,
    };
  }

  it('creates a new version with the source content and returns 200', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'Draft');
    await db.createVersion('v1', 'doc-1', 'original content here', 1);
    await db.createVersion('v2', 'doc-1', 'revised content here', 2);
    const deps = makeDeps(db);
    const res  = await handleRestoreVersion(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    const data = await rj(res);

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.versionNumber).toBe(3);

    const restored = await db.getVersion(data.versionId);
    expect(restored?.content).toBe('original content here');
  });

  it('returns 401 when not authenticated', async () => {
    const db   = makeFakeDb();
    const deps = makeDeps(db, { getSession: async () => null });
    const res  = await handleRestoreVersion(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(401);
  });

  it('returns 404 when document belongs to a different user', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-other', 'Draft');
    await db.createVersion('v1', 'doc-1', 'content here', 1);
    const deps = makeDeps(db);
    const res  = await handleRestoreVersion(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(404);
  });

  it('returns 404 when version belongs to a different document', async () => {
    const db = makeFakeDb();
    await db.createDocument('doc-1', 'user-1', 'D1');
    await db.createDocument('doc-2', 'user-1', 'D2');
    await db.createVersion('v1', 'doc-2', 'content here', 1);
    const deps = makeDeps(db);
    const res  = await handleRestoreVersion(new Request('https://t.example', { method: 'POST' }), 'doc-1', 'v1', deps);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Document retention — no free-tier cap
// ---------------------------------------------------------------------------

describe('limits — a free account keeps every document', () => {
  it('does not archive anything when a free user saves several drafts', async () => {
    let counter = 0;
    const db   = makeFakeDb();
    const deps: CreateDocumentDeps = {
      db,
      getSession: async () => ({ userId: 'u1' }),
      newId:      () => `id-${++counter}`,
    };

    for (const c of ['x', 'y', 'z']) {
      await handleCreateDocument(makeRequest({ content: c.repeat(50) }), deps);
    }

    const active = [...db.docs.values()].filter(d => d.status === 'active');
    expect(active).toHaveLength(3);
    expect([...db.docs.values()].some(d => d.status === 'archived')).toBe(false);
  });
});
