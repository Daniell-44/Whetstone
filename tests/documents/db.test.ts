import { describe, it, expect, beforeEach } from 'vitest';
import type { DocumentDb, Document, DocumentVersion } from '../../functions/_lib/documents/types';

// ---------------------------------------------------------------------------
// Map-backed fake DocumentDb (mirrors real D1 semantics)
// ---------------------------------------------------------------------------

function makeFakeDocumentDb(): DocumentDb {
  const docs     = new Map<string, Document>();
  const versions = new Map<string, DocumentVersion>();

  return {
    createDocument: async (id, userId, title) => {
      const now = Date.now();
      docs.set(id, { id, user_id: userId, title, status: 'active', created_at: now, updated_at: now });
    },

    getDocumentById: async (id) => docs.get(id) ?? null,

    getActiveDocumentForUser: async (userId) => {
      const all = [...docs.values()]
        .filter(d => d.user_id === userId && d.status === 'active')
        .sort((a, b) => b.updated_at - a.updated_at);
      return all[0] ?? null;
    },

    listActiveDocumentsForUser: async (userId) =>
      [...docs.values()]
        .filter(d => d.user_id === userId && d.status === 'active')
        .sort((a, b) => b.updated_at - a.updated_at),

    updateDocumentTitle: async (id, title) => {
      const doc = docs.get(id);
      if (doc) docs.set(id, { ...doc, title, updated_at: Date.now() });
    },

    archiveDocument: async (id) => {
      const doc = docs.get(id);
      if (doc) docs.set(id, { ...doc, status: 'archived', updated_at: Date.now() });
    },

    countActiveDocumentsForUser: async (userId) =>
      [...docs.values()].filter(d => d.user_id === userId && d.status === 'active').length,

    createVersion: async (id, documentId, content, versionNumber) => {
      const now = Date.now();
      versions.set(id, { id, document_id: documentId, content, version_number: versionNumber, audit_result: null, counterarg_result: null, created_at: now });
      const doc = docs.get(documentId);
      if (doc) docs.set(documentId, { ...doc, updated_at: now });
    },

    getLatestVersion: async (documentId) => {
      const all = [...versions.values()]
        .filter(v => v.document_id === documentId)
        .sort((a, b) => b.version_number - a.version_number);
      return all[0] ?? null;
    },

    getVersion: async (versionId) => versions.get(versionId) ?? null,

    listVersions: async (documentId) =>
      [...versions.values()]
        .filter(v => v.document_id === documentId)
        .sort((a, b) => b.version_number - a.version_number),

    storeAuditResultOnVersion: async (versionId, auditResult) => {
      const v = versions.get(versionId);
      if (v) versions.set(versionId, { ...v, audit_result: auditResult });
    },

    storeCounterargResultOnVersion: async (versionId, counterargResult) => {
      const v = versions.get(versionId);
      if (v) versions.set(versionId, { ...v, counterarg_result: counterargResult });
    },

    countVersionsForDocument: async (documentId) =>
      [...versions.values()].filter(v => v.document_id === documentId).length,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentDb (fake)', () => {
  let db: DocumentDb;

  beforeEach(() => { db = makeFakeDocumentDb(); });

  it('creates and retrieves a document', async () => {
    await db.createDocument('doc-1', 'user-a', 'My Draft');
    const doc = await db.getDocumentById('doc-1');
    expect(doc?.title).toBe('My Draft');
    expect(doc?.status).toBe('active');
    expect(doc?.user_id).toBe('user-a');
  });

  it('lists only active documents for the user', async () => {
    await db.createDocument('doc-1', 'user-a', 'Draft 1');
    await db.createDocument('doc-2', 'user-a', 'Draft 2');
    await db.createDocument('doc-3', 'user-b', 'Other user');
    await db.archiveDocument('doc-1');

    const list = await db.listActiveDocumentsForUser('user-a');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('doc-2');
  });

  it('counts active documents correctly', async () => {
    await db.createDocument('doc-1', 'user-a', 'D1');
    await db.createDocument('doc-2', 'user-a', 'D2');
    await db.archiveDocument('doc-1');
    const count = await db.countActiveDocumentsForUser('user-a');
    expect(count).toBe(1);
  });

  it('updates document title', async () => {
    await db.createDocument('doc-1', 'user-a', 'Old title');
    await db.updateDocumentTitle('doc-1', 'New title');
    const doc = await db.getDocumentById('doc-1');
    expect(doc?.title).toBe('New title');
  });

  it('creates versions and returns the latest', async () => {
    await db.createDocument('doc-1', 'user-a', 'Draft');
    await db.createVersion('v1', 'doc-1', 'First draft text.', 1);
    await db.createVersion('v2', 'doc-1', 'Revised draft text.', 2);

    const latest = await db.getLatestVersion('doc-1');
    expect(latest?.id).toBe('v2');
    expect(latest?.version_number).toBe(2);
    expect(latest?.content).toBe('Revised draft text.');
  });

  it('returns null for a missing document or version', async () => {
    expect(await db.getDocumentById('no-such')).toBeNull();
    expect(await db.getLatestVersion('no-doc')).toBeNull();
    expect(await db.getVersion('no-ver')).toBeNull();
  });

  it('stores and retrieves audit result on a version', async () => {
    await db.createDocument('doc-1', 'user-a', 'D');
    await db.createVersion('v1', 'doc-1', 'content', 1);
    await db.storeAuditResultOnVersion('v1', JSON.stringify({ centralClaim: 'test' }));

    const v = await db.getVersion('v1');
    expect(v?.audit_result).toBe(JSON.stringify({ centralClaim: 'test' }));
  });

  it('stores and retrieves counterarg result on a version', async () => {
    await db.createDocument('doc-1', 'user-a', 'D');
    await db.createVersion('v1', 'doc-1', 'content', 1);
    await db.storeCounterargResultOnVersion('v1', JSON.stringify({ counterarguments: [] }));

    const v = await db.getVersion('v1');
    expect(v?.counterarg_result).toBe(JSON.stringify({ counterarguments: [] }));
  });

  it('lists versions in descending version_number order', async () => {
    await db.createDocument('doc-1', 'user-a', 'D');
    await db.createVersion('v1', 'doc-1', 'c1', 1);
    await db.createVersion('v2', 'doc-1', 'c2', 2);
    await db.createVersion('v3', 'doc-1', 'c3', 3);

    const list = await db.listVersions('doc-1');
    expect(list.map(v => v.version_number)).toEqual([3, 2, 1]);
  });

  it('counts versions for a document', async () => {
    await db.createDocument('doc-1', 'user-a', 'D');
    await db.createVersion('v1', 'doc-1', 'c1', 1);
    await db.createVersion('v2', 'doc-1', 'c2', 2);
    expect(await db.countVersionsForDocument('doc-1')).toBe(2);
    expect(await db.countVersionsForDocument('no-such')).toBe(0);
  });
});
