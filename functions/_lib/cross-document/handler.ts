import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { auditCrossDocument } from './engine';
import { checkAndIncrementQuota, quotaIdentity } from '../rate-limit';
import { waitPhrase } from '../billing/limits';
import type { RateLimitKV } from '../rate-limit';
import type { ExtractResult } from '../extract/article';
import type { DocumentInput } from './types';
import {
  MAX_DOCUMENTS, MIN_DOCUMENTS, DOCUMENT_MAX_CHARS, DOCUMENT_MIN_CHARS,
} from './constants';

// Each document is either pasted text or a URL to fetch.
const DocumentSchema = z.union([
  z.object({ kind: z.literal('text'), text: z.string().min(DOCUMENT_MIN_CHARS).max(DOCUMENT_MAX_CHARS), label: z.string().max(120).optional() }),
  z.object({ kind: z.literal('url'),  url:  z.string().url(),                                            label: z.string().max(120).optional() }),
]);

const BodySchema = z.object({
  documents: z.array(DocumentSchema).min(MIN_DOCUMENTS).max(MAX_DOCUMENTS),
});

export interface CrossDocumentHandlerDeps {
  rateLimitKv:         RateLimitKV | undefined;
  geminiApiKey:        string | undefined;
  crossDocDailyCap:    number;
  provider:            LlmProvider;
  extractor:           (url: string) => Promise<ExtractResult>;
  getSession:          (request: Request) => Promise<{ userId: string } | null>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleCrossDocumentRequest(
  request: Request,
  deps:    CrossDocumentHandlerDeps,
): Promise<Response> {
  // Open to anonymous callers; a session only changes how the quota is keyed.
  const session = await deps.getSession(request);

  if (deps.rateLimitKv) {
    const quota = await checkAndIncrementQuota(deps.rateLimitKv, `crossdoc:${quotaIdentity(request, session?.userId)}`, deps.crossDocDailyCap, 'rolling24h');
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: `You've reached the cross-document limit. It reopens ${waitPhrase(quota.resetAt)}.`, resetAt: quota.resetAt } });
    }
  }

  let rawBody: unknown;
  try { rawBody = await request.json(); }
  catch { return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, 400); }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, 400);
  }

  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'CROSSDOC_FAILED', message: 'Service unavailable' } }, 503);
  }

  // Resolve each document to text (fetch URLs, pass through pasted text).
  const documents: DocumentInput[] = [];
  let idx = 0;
  for (const d of parsed.data.documents) {
    idx++;
    if (d.kind === 'url') {
      const extracted = await deps.extractor(d.url);
      if (!extracted.ok) {
        return json({ ok: false, error: { code: 'EXTRACTION_FAILED', message: `Could not extract document ${idx} from URL: ${extracted.error.message}` } }, 400);
      }
      documents.push({
        id:        `doc-${idx}`,
        label:     d.label ?? extracted.article.title ?? `Document ${idx}`,
        sourceUrl: d.url,
        text:      extracted.article.text.slice(0, DOCUMENT_MAX_CHARS),
      });
    } else {
      documents.push({
        id:        `doc-${idx}`,
        label:     d.label ?? `Document ${idx}`,
        sourceUrl: null,
        text:      d.text,
      });
    }
  }

  try {
    const { result, inputTokens, outputTokens } = await auditCrossDocument(documents, {
      provider: deps.provider,
      apiKey:   deps.geminiApiKey,
    });
    return json({ ok: true, result, usage: { inputTokens, outputTokens } });
  } catch (err) {
    if (err instanceof ProviderError && !err.retryable) {
      return json({ ok: false, error: { code: 'CROSSDOC_FAILED', message: 'Service temporarily unavailable' } }, 503);
    }
    const message = err instanceof Error ? err.message : 'Cross-document analysis failed';
    return json({ ok: false, error: { code: 'CROSSDOC_FAILED', message } }, 500);
  }
}
