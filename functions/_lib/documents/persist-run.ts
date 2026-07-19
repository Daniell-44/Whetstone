import type { DocumentDb, DocumentKind } from './types';

// ---------------------------------------------------------------------------
// Persist a completed transcript / cross-document engine run as a document.
//
// These engines run 60-120s and were fire-and-forget: closing the tab lost
// the result. For signed-in users the API routes call this after a successful
// run: one document (kind = 'transcript' | 'cross-doc') with a single version
// holding the input snapshot as content and the full result in result_json.
//
// Both engines are subscription-gated, so the free-tier one-active-document
// limit (documents/limits.ts) is deliberately not applied here.
//
// Persistence must never break a successful run the user already paid the
// wait for — callers wrap this in try/catch and drop failures.
// ---------------------------------------------------------------------------

export interface PersistRunInput {
  userId:     string;
  kind:       Exclude<DocumentKind, 'draft'>;
  title:      string;
  /** Human-readable snapshot of what was analysed (transcript text, doc list). */
  content:    string;
  /** Full engine result JSON (TranscriptAuditResult / CrossDocumentResult). */
  resultJson: string;
}

export async function persistEngineRun(
  db:    DocumentDb,
  newId: () => string,
  input: PersistRunInput,
): Promise<{ docId: string; versionId: string }> {
  const docId     = newId();
  const versionId = newId();
  const title     = input.title.trim().slice(0, 200) || 'Untitled run';
  // content is NOT NULL in the schema; guarantee something readable.
  const content   = input.content.trim() || '(input unavailable)';

  await db.createDocument(docId, input.userId, title, undefined, input.kind);
  await db.createVersion(versionId, docId, content, 1);
  await db.storeResultJsonOnVersion(versionId, input.resultJson);
  return { docId, versionId };
}
