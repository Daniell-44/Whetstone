import { z }              from 'zod';
import type { LlmProvider }  from '../providers/types';
import { ProviderError }     from '../providers/types';
import type { ExtractResult } from '../extract/article';
import type { RateLimitKV }  from '../rate-limit';
import { checkAndIncrementQuota } from '../rate-limit';
import { auditCitations }    from './engine';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const BodySchema = z.object({
  text: z.string()
    .min(50,  'Text must be at least 50 characters')
    .max(10_000, 'Text must be at most 10,000 characters'),
  // Optional persistence target: when both are present (Studio), the SERVER
  // writes the result onto the version after the run, so a phone locking or
  // the tab suspending mid-run can no longer silently lose Source Match
  // (previously the client fired a second fetch to persist, which died with
  // the tab). Ownership is verified by the injected persistResult.
  documentId: z.string().optional(),
  versionId:  z.string().optional(),
});

// ---------------------------------------------------------------------------
// Dependencies — all injectable for testing
// ---------------------------------------------------------------------------

export interface CitationHandlerDeps {
  rateLimitKv:       RateLimitKV | undefined;
  geminiApiKey:      string | undefined;
  citationDailyCap:  number;
  provider:          LlmProvider;
  extractor:         (url: string) => Promise<ExtractResult>;
  getSession:        (request: Request) => Promise<{ userId: string } | null>;
  checkSubscription: (userId: string) => Promise<boolean>;
  /** Persist the result onto a document version, verifying the document
     belongs to userId. Must swallow nothing: throw or return false on any
     failure (the handler logs-and-continues; persistence never fails a run). */
  persistResult?:    (userId: string, documentId: string, versionId: string, resultJson: string) => Promise<boolean>;
  /** Cloudflare ctx.waitUntil — keeps the run+persist alive if the client
     disconnects (screen lock, tab suspension) mid-request. */
  waitUntil?:        (p: Promise<unknown>) => void;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleCitationAuditRequest(
  request: Request,
  deps:    CitationHandlerDeps,
): Promise<Response> {

  if (request.method !== 'POST') {
    return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } }, 405);
  }

  // Auth gate.
  const session = await deps.getSession(request);
  if (!session) {
    return json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sign in to use Studio' } }, 401);
  }

  // Subscription gate.
  const hasSubscription = await deps.checkSubscription(session.userId);
  if (!hasSubscription) {
    return json({
      ok:    false,
      error: { code: 'SUBSCRIPTION_REQUIRED', message: 'Active Studio subscription required.' },
    }, 402);
  }

  // Per-user rate limit.
  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(
      deps.rateLimitKv,
      `citation:user:${session.userId}`,
      deps.citationDailyCap,
    );
    if (!quota.allowed) {
      return json({
        ok:    false,
        error: { code: 'RATE_LIMITED', message: 'Daily citation-audit limit reached — try again tomorrow.' },
      }, 429);
    }
  }

  // Parse body.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, 400);
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({
      ok:    false,
      error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
    }, 400);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' } }, 503);
  }

  // Run citation audit. The run + persistence are one unit of work registered
  // with waitUntil BEFORE awaiting, so a client disconnect (phone screen lock
  // during the 60-90s Pro run) cannot kill the result: it lands on the version
  // server-side and the reopened draft rehydrates it.
  try {
    const { documentId, versionId } = parsed.data;
    const work = (async () => {
      const out = await auditCitations(
        parsed.data.text,
        {
          provider:  deps.provider,
          apiKey:    deps.geminiApiKey!,
          extractor: deps.extractor,
        },
      );
      if (documentId && versionId && deps.persistResult) {
        try {
          await deps.persistResult(session.userId, documentId, versionId, JSON.stringify(out.result));
        } catch {
          // Persistence must never fail the run - the client still gets the
          // result and can retry its own save path.
        }
      }
      return out;
    })();
    deps.waitUntil?.(work.catch(() => {}));

    const { result, inputTokens, outputTokens, citationsFetched, citationsFailed } = await work;
    return json({
      ok: true,
      result,
      usage: { inputTokens, outputTokens, citationsFetched, citationsFailed },
    });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'CITATION_AUDIT_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Citation audit failed';
    return json({ ok: false, error: { code: 'CITATION_AUDIT_FAILED', message } }, 500);
  }
}
