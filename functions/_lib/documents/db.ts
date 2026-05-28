import type { Document, DocumentVersion, DocumentDb } from './types';

export function makeDocumentDb(d1: D1Database): DocumentDb {
  return {
    createDocument: async (id, userId, title) => {
      const now = Date.now();
      await d1
        .prepare('INSERT INTO documents (id, user_id, title, status, created_at, updated_at) VALUES (?, ?, ?, \'active\', ?, ?)')
        .bind(id, userId, title, now, now)
        .run();
    },

    getDocumentById: (id) =>
      d1.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first<Document>(),

    getActiveDocumentForUser: (userId) =>
      d1
        .prepare("SELECT * FROM documents WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1")
        .bind(userId)
        .first<Document>(),

    listActiveDocumentsForUser: async (userId) => {
      const result = await d1
        .prepare("SELECT * FROM documents WHERE user_id = ? AND status = 'active' ORDER BY updated_at DESC")
        .bind(userId)
        .all<Document>();
      return result.results;
    },

    updateDocumentTitle: async (id, title) => {
      const now = Date.now();
      await d1
        .prepare('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?')
        .bind(title, now, id)
        .run();
    },

    archiveDocument: async (id) => {
      const now = Date.now();
      await d1
        .prepare("UPDATE documents SET status = 'archived', updated_at = ? WHERE id = ?")
        .bind(now, id)
        .run();
    },

    countActiveDocumentsForUser: async (userId) => {
      const row = await d1
        .prepare("SELECT COUNT(*) AS count FROM documents WHERE user_id = ? AND status = 'active'")
        .bind(userId)
        .first<{ count: number }>();
      return row?.count ?? 0;
    },

    createVersion: async (id, documentId, content, versionNumber) => {
      const now = Date.now();
      await d1
        .prepare('INSERT INTO document_versions (id, document_id, content, version_number, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(id, documentId, content, versionNumber, now)
        .run();
      await d1
        .prepare('UPDATE documents SET updated_at = ? WHERE id = ?')
        .bind(now, documentId)
        .run();
    },

    getLatestVersion: (documentId) =>
      d1
        .prepare('SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC LIMIT 1')
        .bind(documentId)
        .first<DocumentVersion>(),

    getVersion: (versionId) =>
      d1
        .prepare('SELECT * FROM document_versions WHERE id = ?')
        .bind(versionId)
        .first<DocumentVersion>(),

    listVersions: async (documentId) => {
      const result = await d1
        .prepare('SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC')
        .bind(documentId)
        .all<DocumentVersion>();
      return result.results;
    },

    storeAuditResultOnVersion: async (versionId, auditResult) => {
      await d1
        .prepare('UPDATE document_versions SET audit_result = ? WHERE id = ?')
        .bind(auditResult, versionId)
        .run();
    },

    storeCounterargResultOnVersion: async (versionId, counterargResult) => {
      await d1
        .prepare('UPDATE document_versions SET counterarg_result = ? WHERE id = ?')
        .bind(counterargResult, versionId)
        .run();
    },
  };
}
