export interface Document {
  id:         string;
  user_id:    string;
  title:      string;
  status:     'active' | 'archived';
  created_at: number;
  updated_at: number;
}

export interface DocumentVersion {
  id:                string;
  document_id:       string;
  content:           string;
  version_number:    number;
  audit_result:      string | null;
  counterarg_result: string | null;
  extraction_json:   string | null;
  commitments_json:  string | null;
  created_at:        number;
}

export interface DocumentDb {
  createDocument(id: string, userId: string, title: string): Promise<void>;
  getDocumentById(id: string): Promise<Document | null>;
  getActiveDocumentForUser(userId: string): Promise<Document | null>;
  listActiveDocumentsForUser(userId: string): Promise<Document[]>;
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
}
