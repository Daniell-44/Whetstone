// 'draft' = Studio draft; 'transcript' / 'cross-doc' = a persisted engine run
// (the input snapshot lives in the version content, the full engine result in
// result_json). Migration 0020 defaults existing rows to 'draft'.
export type DocumentKind = 'draft' | 'transcript' | 'cross-doc';

export interface Document {
  id:           string;
  user_id:      string;
  workspace_id: string | null;
  title:        string;
  status:       'active' | 'archived';
  kind:         DocumentKind;
  created_at:   number;
  updated_at:   number;
}

export interface DocumentVersion {
  id:                   string;
  document_id:          string;
  content:              string;
  version_number:       number;
  audit_result:         string | null;
  counterarg_result:    string | null;
  extraction_json:      string | null;
  commitments_json:     string | null;
  citation_audit_json:  string | null;
  // Full engine result for transcript / cross-doc runs. Kept separate from
  // audit_result on purpose: audit_result is always an AuditResult and the
  // draft version surfaces render it as one (see migration 0020).
  result_json:          string | null;
  created_at:           number;
}

export interface DocumentDb {
  createDocument(id: string, userId: string, title: string, workspaceId?: string, kind?: DocumentKind): Promise<void>;
  getDocumentById(id: string): Promise<Document | null>;
  getActiveDocumentForUser(userId: string): Promise<Document | null>;
  listActiveDocumentsForUser(userId: string): Promise<Document[]>;
  listActiveDocumentsForWorkspace(workspaceId: string): Promise<Document[]>;
  updateDocumentTitle(id: string, title: string): Promise<void>;
  archiveDocument(id: string): Promise<void>;
  countActiveDocumentsForUser(userId: string): Promise<number>;
  createVersion(id: string, documentId: string, content: string, versionNumber: number): Promise<void>;
  getLatestVersion(documentId: string): Promise<DocumentVersion | null>;
  getVersion(versionId: string): Promise<DocumentVersion | null>;
  listVersions(documentId: string): Promise<DocumentVersion[]>;
  countVersionsForDocument(documentId: string): Promise<number>;
  storeAuditResultOnVersion(versionId: string, auditResult: string): Promise<void>;
  storeCounterargResultOnVersion(versionId: string, counterargResult: string): Promise<void>;
  storeExtractionOnVersion(versionId: string, extractionJson: string): Promise<void>;
  storeCommitmentsOnVersion(versionId: string, commitmentsJson: string): Promise<void>;
  storeCitationAuditOnVersion(versionId: string, citationAuditJson: string): Promise<void>;
  storeResultJsonOnVersion(versionId: string, resultJson: string): Promise<void>;
}
