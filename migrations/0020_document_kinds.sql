-- 0020: document kinds + engine-run result storage.
--
-- documents.kind distinguishes Studio drafts from persisted transcript and
-- cross-document runs. Existing rows default to 'draft' (backwards compatible).
--
-- document_versions.result_json is a DEDICATED column for the full engine
-- result of a transcript / cross-document run (TranscriptAuditResult or
-- CrossDocumentResult JSON). We deliberately do NOT reuse audit_result:
-- audit_result holds an AuditResult and is rendered as one by the draft
-- versions / compare surfaces (VersionsList and friends). Storing a different
-- shape there would corrupt those read paths for anyone who opens a
-- transcript or cross-doc document through the drafts UI.
ALTER TABLE documents ADD COLUMN kind TEXT NOT NULL DEFAULT 'draft'
  CHECK(kind IN ('draft', 'transcript', 'cross-doc'));

ALTER TABLE document_versions ADD COLUMN result_json TEXT;
