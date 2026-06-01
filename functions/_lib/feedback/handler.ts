import { z } from 'zod';
import type { FeedbackDb, FeedbackFilters } from './db';
import type { FeedbackType, TargetLens } from './types';
import { checkAndIncrementQuota } from '../rate-limit';
import type { RateLimitKV } from '../rate-limit';

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Submit — POST /api/feedback
// ---------------------------------------------------------------------------

const TARGET_LENS_VALUES = ['namedFallacies', 'loadedLanguage', 'unstatedWarrants', 'counterarguments', 'keyTermScrutiny', 'referentChecks', 'falsifiabilityChecks'] as const;

const SubmitBodySchema = z.object({
  feedbackType:    z.enum(['finding_thumbs_up', 'finding_thumbs_down', 'audit_rating', 'bug_report']),
  documentId:      z.string().optional().nullable(),
  versionId:       z.string().optional().nullable(),
  targetLens:      z.enum(TARGET_LENS_VALUES).optional().nullable(),
  matchKey:        z.string().optional().nullable(),
  findingSnapshot: z.unknown().optional().nullable(),
  rating:          z.number().int().min(1).max(5).optional().nullable(),
  qualitative:     z.string().max(500).optional().nullable(),
});

export interface SubmitFeedbackDeps {
  db:           FeedbackDb;
  rateLimitKv?: RateLimitKV;
  feedbackDailyCap: number;
  newId:        () => string;
  getSession:   (req: Request) => Promise<{ userId: string } | null>;
  getDocumentOwnerId?: (docId: string) => Promise<string | null>;
}

export async function handleSubmitFeedback(
  req:  Request,
  deps: SubmitFeedbackDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } }, 405);
  }

  const session = await deps.getSession(req);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, 401);
  }

  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(
      deps.rateLimitKv,
      `feedback:user:${session.userId}`,
      deps.feedbackDailyCap,
    );
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Feedback limit reached — try again tomorrow.' } }, 429);
    }
  }

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON' } }, 400);
  }

  const parsed = SubmitBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  const data = parsed.data;

  // Finding-level types require targetLens, matchKey, findingSnapshot
  if (data.feedbackType === 'finding_thumbs_up' || data.feedbackType === 'finding_thumbs_down') {
    if (!data.targetLens) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'targetLens is required for finding feedback' } }, 400);
    }
    if (!data.matchKey?.trim()) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'matchKey is required for finding feedback' } }, 400);
    }
    if (data.findingSnapshot == null) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'findingSnapshot is required for finding feedback' } }, 400);
    }
  }

  // audit_rating requires rating
  if (data.feedbackType === 'audit_rating' && (data.rating == null)) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'rating is required for audit_rating' } }, 400);
  }

  // Ownership check when documentId is present
  if (data.documentId && deps.getDocumentOwnerId) {
    const ownerId = await deps.getDocumentOwnerId(data.documentId);
    if (!ownerId || ownerId !== session.userId) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
    }
  }

  await deps.db.recordFeedback({
    id:              deps.newId(),
    userId:          session.userId,
    feedbackType:    data.feedbackType as FeedbackType,
    documentId:      data.documentId  ?? null,
    versionId:       data.versionId   ?? null,
    targetLens:      data.targetLens  as TargetLens | null ?? null,
    matchKey:        data.matchKey?.trim() ?? null,
    findingSnapshot: data.findingSnapshot ?? null,
    rating:          data.rating      ?? null,
    qualitative:     data.qualitative ?? null,
  });

  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Admin review — GET /api/admin/feedback
// ---------------------------------------------------------------------------

export interface AdminFeedbackDeps {
  db:           FeedbackDb;
  adminSecret:  string | undefined;
}

function parseSinceMs(raw: string): number | null {
  const relMatch = raw.match(/^(\d+)d$/i);
  if (relMatch) {
    const days = parseInt(relMatch[1], 10);
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.getTime();
}

export async function handleAdminFeedback(
  req:  Request,
  deps: AdminFeedbackDeps,
): Promise<Response> {
  if (req.method !== 'GET') {
    return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'GET only' } }, 405);
  }

  const secret = req.headers.get('X-Analyser-Secret');
  if (!deps.adminSecret || secret !== deps.adminSecret) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid secret' } }, 401);
  }

  const url    = new URL(req.url);
  const since  = url.searchParams.get('since');
  const lens   = url.searchParams.get('lens')   ?? undefined;
  const type   = url.searchParams.get('type')   ?? undefined;
  const format = url.searchParams.get('format') ?? 'summary';

  if (!since) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'since parameter is required (ISO date or "7d"/"30d")' } }, 400);
  }

  const sinceMs = parseSinceMs(since);
  if (sinceMs === null) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'since must be an ISO date string or relative like "30d"' } }, 400);
  }

  const filters: FeedbackFilters = {};
  if (lens) filters.lens = lens;
  if (type) filters.type = type;

  if (format === 'json') {
    const rows = await deps.db.listFeedbackSince(sinceMs, filters);
    return json({ ok: true, count: rows.length, rows });
  }

  const summary = await deps.db.summariseFeedback(sinceMs, filters);
  return json(summary);
}
