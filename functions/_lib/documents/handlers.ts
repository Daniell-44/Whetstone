import { z } from 'zod';
import type { DocumentDb } from './types';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { auditText } from '../audit/engine';
import { generateCounterarguments } from '../counterargument/engine';
import { extractArgument } from '../argument-extraction/engine';
import { ensureFreeUserCanCreateDocument } from './limits';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// POST /api/documents  — create document + first version
// ---------------------------------------------------------------------------

export interface CreateDocumentDeps {
  db:                DocumentDb;
  getSession:        (req: Request) => Promise<{ userId: string } | null>;
  checkSubscription: (userId: string) => Promise<boolean>;
  newId:             () => string;
}

const CreateDocSchema = z.object({
  title:   z.string().min(1).max(200).default('Untitled draft'),
  content: z.string().min(50).max(10_000),
});

export async function handleCreateDocument(
  req:  Request,
  deps: CreateDocumentDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = CreateDocSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  const hasSubscription = await deps.checkSubscription(session.userId);
  await ensureFreeUserCanCreateDocument(deps.db, session.userId, hasSubscription);

  const docId     = deps.newId();
  const versionId = deps.newId();
  await deps.db.createDocument(docId, session.userId, parsed.data.title);
  await deps.db.createVersion(versionId, docId, parsed.data.content, 1);

  return json({ ok: true, docId, versionId });
}

// ---------------------------------------------------------------------------
// POST /api/documents/[id]/versions  — append a new version
// ---------------------------------------------------------------------------

export interface CreateVersionDeps {
  db:         DocumentDb;
  getSession: (req: Request) => Promise<{ userId: string } | null>;
  newId:      () => string;
}

const CreateVersionSchema = z.object({
  content: z.string().min(50).max(10_000),
});

export async function handleCreateVersion(
  req:   Request,
  docId: string,
  deps:  CreateVersionDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const doc = await deps.db.getDocumentById(docId);
  if (!doc || doc.user_id !== session.userId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = CreateVersionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  const latest        = await deps.db.getLatestVersion(docId);
  const nextNumber    = (latest?.version_number ?? 0) + 1;
  const versionId     = deps.newId();
  await deps.db.createVersion(versionId, docId, parsed.data.content, nextNumber);

  return json({ ok: true, versionId, versionNumber: nextNumber });
}

// ---------------------------------------------------------------------------
// POST /api/documents/[id]/versions/[versionId]/audit
// ---------------------------------------------------------------------------

export interface VersionAuditDeps {
  db:           DocumentDb;
  provider:     LlmProvider;
  geminiApiKey: string | undefined;
  getSession:   (req: Request) => Promise<{ userId: string } | null>;
}

export async function handleVersionAudit(
  req:       Request,
  docId:     string,
  versionId: string,
  deps:      VersionAuditDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const doc = await deps.db.getDocumentById(docId);
  if (!doc || doc.user_id !== session.userId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const version = await deps.db.getVersion(versionId);
  if (!version || version.document_id !== docId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service unavailable' } }, 503);
  }

  try {
    const result = await auditText(version.content, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    await deps.db.storeAuditResultOnVersion(versionId, JSON.stringify(result.audit));
    return json({ ok: true, audit: result.audit, usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens } });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Audit failed';
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message } }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/documents/[id]/versions/[versionId]/counterargument
// ---------------------------------------------------------------------------

export interface VersionCounterargDeps {
  db:                DocumentDb;
  provider:          LlmProvider;
  geminiApiKey:      string | undefined;
  getSession:        (req: Request) => Promise<{ userId: string } | null>;
  checkSubscription: (userId: string) => Promise<boolean>;
}

export async function handleVersionCounterarg(
  req:       Request,
  docId:     string,
  versionId: string,
  deps:      VersionCounterargDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const hasSubscription = await deps.checkSubscription(session.userId);
  if (!hasSubscription) {
    return json({ ok: false, error: { code: 'SUBSCRIPTION_REQUIRED', message: 'Active subscription required' } }, 402);
  }

  const doc = await deps.db.getDocumentById(docId);
  if (!doc || doc.user_id !== session.userId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const version = await deps.db.getVersion(versionId);
  if (!version || version.document_id !== docId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service unavailable' } }, 503);
  }

  try {
    const { result, inputTokens, outputTokens } = await generateCounterarguments(version.content, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    await deps.db.storeCounterargResultOnVersion(versionId, JSON.stringify(result));
    return json({ ok: true, result, usage: { inputTokens, outputTokens } });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Counterargument generation failed';
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message } }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/documents/[id]/versions/[versionId]/extraction
// ---------------------------------------------------------------------------

export interface VersionExtractionDeps {
  db:           DocumentDb;
  provider:     LlmProvider;
  geminiApiKey: string | undefined;
  getSession:   (req: Request) => Promise<{ userId: string } | null>;
}

export async function handleVersionExtraction(
  req:       Request,
  docId:     string,
  versionId: string,
  deps:      VersionExtractionDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const doc = await deps.db.getDocumentById(docId);
  if (!doc || doc.user_id !== session.userId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const version = await deps.db.getVersion(versionId);
  if (!version || version.document_id !== docId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'EXTRACTION_FAILED', message: 'Service unavailable' } }, 503);
  }

  try {
    const { result, inputTokens, outputTokens } = await extractArgument(version.content, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    await deps.db.storeExtractionOnVersion(versionId, JSON.stringify(result));
    return json({ ok: true, extraction: result, usage: { inputTokens, outputTokens } });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'EXTRACTION_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Argument extraction failed';
    return json({ ok: false, error: { code: 'EXTRACTION_FAILED', message } }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/documents/[id]/versions/[versionId]/restore
// Creates a new version whose content is copied from the specified version.
// ---------------------------------------------------------------------------

export interface RestoreVersionDeps {
  db:         DocumentDb;
  getSession: (req: Request) => Promise<{ userId: string } | null>;
  newId:      () => string;
}

export async function handleRestoreVersion(
  req:       Request,
  docId:     string,
  versionId: string,
  deps:      RestoreVersionDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const doc = await deps.db.getDocumentById(docId);
  if (!doc || doc.user_id !== session.userId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const version = await deps.db.getVersion(versionId);
  if (!version || version.document_id !== docId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Version not found' } }, 404);
  }

  const latest     = await deps.db.getLatestVersion(docId);
  const nextNumber = (latest?.version_number ?? 0) + 1;
  const newVerId   = deps.newId();
  await deps.db.createVersion(newVerId, docId, version.content, nextNumber);

  return json({ ok: true, versionId: newVerId, versionNumber: nextNumber });
}
