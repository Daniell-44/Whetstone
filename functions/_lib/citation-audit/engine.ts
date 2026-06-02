import type { LlmProvider }  from '../providers/types';
import type { ExtractResult } from '../extract/article';
import { callWithRetry }      from '../llm/retry';
import { ExtractedClaimsSchema, VerdictResultSchema } from './schemas';
import { STAGE1_SYSTEM_PROMPT, STAGE2_SYSTEM_PROMPT, buildStage2UserMessage } from './prompts';
import {
  CITATION_CLAIM_EXTRACTION_MODEL,
  CITATION_VERDICT_MODEL,
  MAX_CITED_CLAIMS_PER_AUDIT,
  CITATION_FETCH_PARALLELISM,
} from './constants';
import type { CitedClaim, CitationAuditResult } from './types';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface CitationAuditDeps {
  provider:         LlmProvider;
  apiKey:           string;
  extractor:        (url: string) => Promise<ExtractResult>;
  backoffDelaysMs?: readonly number[];
}

export interface CitationAuditOutput {
  result:           CitationAuditResult;
  inputTokens:      number;
  outputTokens:     number;
  citationsFetched: number;
  citationsFailed:  number;
}

// ---------------------------------------------------------------------------
// Verdict for non-LLM paths
// ---------------------------------------------------------------------------

function uncitedClaim(raw: { claim: string; evidenceQuote: string; citationUrl: null; citationContext?: string | null }): CitedClaim {
  return {
    ...raw,
    citationContext:    raw.citationContext ?? undefined,
    verdict:            'uncited',
    verdictExplanation: 'No citation was provided for this claim.',
    sourceExcerpt:      null,
    sourceTitle:        null,
    sourcePublication:  null,
    confidence:         95,
  };
}

function unfetchableClaim(raw: { claim: string; evidenceQuote: string; citationUrl: string; citationContext?: string | null }): CitedClaim {
  return {
    ...raw,
    citationContext:    raw.citationContext ?? undefined,
    verdict:            'unfetchable',
    verdictExplanation: 'The cited source could not be retrieved (paywalled, 404, or network error).',
    sourceExcerpt:      null,
    sourceTitle:        null,
    sourcePublication:  null,
    confidence:         100,
  };
}

// ---------------------------------------------------------------------------
// Concurrency-limited batch fetch
// ---------------------------------------------------------------------------

async function fetchInBatches(
  urls:      string[],
  extractor: (url: string) => Promise<ExtractResult>,
  batchSize: number,
): Promise<Map<string, ExtractResult>> {
  const results = new Map<string, ExtractResult>();

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (url) => {
        try {
          results.set(url, await extractor(url));
        } catch {
          results.set(url, { ok: false, error: { code: 'FETCH_FAILED', message: 'fetch threw' } });
        }
      }),
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function auditCitations(
  text: string,
  deps: CitationAuditDeps,
): Promise<CitationAuditOutput> {
  const backoff = deps.backoffDelaysMs;
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;

  // -------------------------------------------------------------------------
  // Stage 1 — extract factual claims + citations
  // -------------------------------------------------------------------------

  const stage1 = await callWithRetry(
    () => deps.provider.complete(
      {
        operation:         'triage',
        model:             CITATION_CLAIM_EXTRACTION_MODEL,
        systemInstruction: STAGE1_SYSTEM_PROMPT,
        messages:          [{ role: 'user', content: text }],
        responseFormat:    'json',
      },
      deps.apiKey,
    ),
    ExtractedClaimsSchema,
    'citation-stage1',
    backoff,
  );

  totalInputTokens  += stage1.inputTokens;
  totalOutputTokens += stage1.outputTokens;

  const rawClaims = stage1.output.claims.slice(0, MAX_CITED_CLAIMS_PER_AUDIT);

  // -------------------------------------------------------------------------
  // Fetch cited sources in parallel (batched by CITATION_FETCH_PARALLELISM)
  // -------------------------------------------------------------------------

  const uniqueUrls = [...new Set(rawClaims.map(c => c.citationUrl).filter((u): u is string => u !== null))];
  const fetchMap   = await fetchInBatches(uniqueUrls, deps.extractor, CITATION_FETCH_PARALLELISM);

  let citationsFetched = 0;
  let citationsFailed  = 0;
  for (const result of fetchMap.values()) {
    if (result.ok) citationsFetched++;
    else           citationsFailed++;
  }

  // -------------------------------------------------------------------------
  // Stage 2 — per-claim verdict (only for successfully fetched sources)
  // -------------------------------------------------------------------------

  const verdictPromises = rawClaims.map(async (raw): Promise<CitedClaim> => {
    // Uncited — no LLM call needed
    if (!raw.citationUrl) {
      return uncitedClaim({ ...raw, citationUrl: null });
    }

    const fetchResult = fetchMap.get(raw.citationUrl);

    // Unfetchable — no LLM call needed
    if (!fetchResult || !fetchResult.ok) {
      return unfetchableClaim({ ...raw, citationUrl: raw.citationUrl });
    }

    // Successfully fetched — call Stage 2
    const { article } = fetchResult;
    const stage2 = await callWithRetry(
      () => deps.provider.complete(
        {
          operation:         'analyze',
          model:             CITATION_VERDICT_MODEL,
          systemInstruction: STAGE2_SYSTEM_PROMPT,
          messages: [{
            role:    'user',
            content: buildStage2UserMessage(raw.claim, raw.citationUrl!, article.text),
          }],
          responseFormat: 'json',
        },
        deps.apiKey,
      ),
      VerdictResultSchema,
      'citation-stage2',
      backoff,
    );

    totalInputTokens  += stage2.inputTokens;
    totalOutputTokens += stage2.outputTokens;

    return {
      claim:              raw.claim,
      evidenceQuote:      raw.evidenceQuote,
      citationUrl:        raw.citationUrl,
      citationContext:    raw.citationContext ?? undefined,
      verdict:            stage2.output.verdict,
      verdictExplanation: stage2.output.verdictExplanation,
      sourceExcerpt:      stage2.output.sourceExcerpt,
      sourceTitle:        article.title       ?? null,
      sourcePublication:  article.publication ?? null,
      confidence:         stage2.output.confidence,
    };
  });

  const settled = await Promise.allSettled(verdictPromises);

  const factualClaims: CitedClaim[] = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    // Stage 2 threw — treat as unfetchable rather than crashing the whole audit
    const raw = rawClaims[i]!;
    return raw.citationUrl
      ? unfetchableClaim({ ...raw, citationUrl: raw.citationUrl })
      : uncitedClaim({ ...raw, citationUrl: null });
  });

  // -------------------------------------------------------------------------
  // Sort: mismatched → uncited → unfetchable → weakly_cited → well_cited
  // -------------------------------------------------------------------------

  const VERDICT_ORDER: Record<string, number> = {
    mismatched:  0,
    uncited:     1,
    unfetchable: 2,
    weakly_cited: 3,
    well_cited:  4,
    non_factual: 5,
  };

  factualClaims.sort((a, b) => {
    const ao = VERDICT_ORDER[a.verdict] ?? 99;
    const bo = VERDICT_ORDER[b.verdict] ?? 99;
    if (ao !== bo) return ao - bo;
    return b.confidence - a.confidence; // within group: higher confidence first
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  const summary = {
    total:       factualClaims.length,
    wellCited:   factualClaims.filter(c => c.verdict === 'well_cited').length,
    weaklyCited: factualClaims.filter(c => c.verdict === 'weakly_cited').length,
    mismatched:  factualClaims.filter(c => c.verdict === 'mismatched').length,
    uncited:     factualClaims.filter(c => c.verdict === 'uncited').length,
    unfetchable: factualClaims.filter(c => c.verdict === 'unfetchable').length,
  };

  return {
    result: { factualClaims, notes: null, summary },
    inputTokens:      totalInputTokens,
    outputTokens:     totalOutputTokens,
    citationsFetched,
    citationsFailed,
  };
}
