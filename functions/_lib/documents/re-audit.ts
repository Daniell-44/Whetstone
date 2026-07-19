import type { DocumentDb } from './types';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { auditText } from '../audit/engine';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';
import { resolveAuditQuota } from '../billing/limits';
import { computeFindingDeltaFromJson, type FindingDelta } from './finding-delta';

// ---------------------------------------------------------------------------
// POST /api/documents/[id]/re-audit
//
// The week-2 retention cue: re-run the audit on a draft's latest version,
// store the result as a NEW version (same content, next version number), and
// return the finding delta versus the most recent previously-audited version.
//
// Quota: this consumes one audit from the SAME bucket as /api/audit — the
// key format mirrors audit/handler.ts exactly so the two endpoints share a
// counter. The UI labels the affordance accordingly.
// ---------------------------------------------------------------------------

export interface ReAuditDeps {
  db:                DocumentDb;
  provider:          LlmProvider;
  geminiApiKey:      string | undefined;
  rateLimitKv:       RateLimitKV | undefined;
  getSession:        (req: Request) => Promise<{ userId: string } | null>;
  checkSubscription: (userId: string) => Promise<boolean>;
  newId:             () => string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleReAudit(
  req:   Request,
  docId: string,
  deps:  ReAuditDeps,
): Promise<Response> {
  const session = await deps.getSession(req);
  if (!session) return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);

  const doc = await deps.db.getDocumentById(docId);
  if (!doc || doc.user_id !== session.userId) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }
  if (doc.kind !== 'draft') {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Only drafts can be re-audited.' } }, 400);
  }

  const latest = await deps.db.getLatestVersion(docId);
  if (!latest) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document has no versions' } }, 404);
  }

  // Consume one audit from the same quota bucket as /api/audit.
  if (deps.rateLimitKv) {
    const hasSub = await deps.checkSubscription(session.userId);
    const quota  = resolveAuditQuota(true, hasSub);
    const key    = `audit:user:${session.userId}:${quota.period}`;
    const result = await checkAndIncrementQuota(deps.rateLimitKv, key, quota.cap, quota.period);
    if (!result.allowed) {
      const when = quota.period === 'month' ? 'this month' : 'today';
      return json({
        ok:    false,
        error: { code: 'RATE_LIMITED', message: `You've used all ${quota.cap} audits ${when}.` },
      });
    }
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service unavailable' } }, 503);
  }

  // The delta baseline is the most recent version that has a stored audit
  // (which may be older than the latest version if recent saves went unaudited).
  const versions       = await deps.db.listVersions(docId);
  const prevAuditJson  = versions
    .slice()
    .sort((a, b) => b.version_number - a.version_number)
    .find(v => v.audit_result !== null)?.audit_result ?? null;

  try {
    const run          = await auditText(latest.content, {
      provider:      deps.provider,
      apiKey:        deps.geminiApiKey,
      includePhase2: true, // parity with the Studio version-audit path
    });
    const newAuditJson = JSON.stringify(run.audit);

    const versionId  = deps.newId();
    const nextNumber = latest.version_number + 1;
    await deps.db.createVersion(versionId, docId, latest.content, nextNumber);
    await deps.db.storeAuditResultOnVersion(versionId, newAuditJson);

    const delta: FindingDelta = computeFindingDeltaFromJson(prevAuditJson, newAuditJson);

    return json({
      ok: true,
      versionId,
      versionNumber:    nextNumber,
      hadPreviousAudit: prevAuditJson !== null,
      delta,
    });
  } catch (err) {
    console.error('[re-audit] error:', err instanceof Error ? err.message : err);
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'AUDIT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Re-audit failed';
    return json({ ok: false, error: { code: 'AUDIT_FAILED', message } }, 500);
  }
}
