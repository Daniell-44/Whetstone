import { callWithRetry } from '../llm/retry';
import { auditText } from '../audit/engine';
import { extractArgument } from '../argument-extraction/engine';
import { CrossDocumentSynthesisSchema } from './schemas';
import { CROSSDOC_SYNTHESIS_SYSTEM_PROMPT, buildCrossDocPrompt } from './prompts';
import {
  CROSSDOC_SYNTHESIS_MODEL, CROSSDOC_SYNTHESIS_THINKING_BUDGET,
  MAX_PARALLEL_AUDITS, DOCUMENT_PREVIEW_CHARS,
} from './constants';
import type {
  DocumentInput, DocumentAudit, CrossDocumentSynthesis,
  CrossDocumentResult, CrossDocumentDeps,
} from './types';

export interface CrossDocumentOutput {
  result:       CrossDocumentResult;
  inputTokens:  number;
  outputTokens: number;
}

// Drop synthesis findings whose evidence quotes aren't verbatim in the cited doc.
function filterValidEvidence(
  synthesis: CrossDocumentSynthesis,
  docsById:  Map<string, DocumentInput>,
): CrossDocumentSynthesis {
  const findings = synthesis.findings.filter((f) => {
    // Every evidence quote must be verbatim in its cited document.
    for (const ev of f.evidence) {
      const doc = docsById.get(ev.documentId);
      if (!doc || !doc.text.includes(ev.quote)) return false;
    }
    return true;
  });
  return { ...synthesis, findings };
}

export async function auditCrossDocument(
  documents: DocumentInput[],
  deps:      CrossDocumentDeps,
): Promise<CrossDocumentOutput> {
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;

  const parallelism = deps.maxParallelAudits ?? MAX_PARALLEL_AUDITS;

  // ===== Stage A — audit each document (parallel, throttled) =====
  const documentAudits: DocumentAudit[] = [];

  for (let i = 0; i < documents.length; i += parallelism) {
    const batch = documents.slice(i, i + parallelism);
    const settled = await Promise.allSettled(
      batch.map(async (doc) => {
        const [auditOut, extractionOut] = await Promise.all([
          auditText(doc.text, { provider: deps.provider, apiKey: deps.apiKey, includePhase2: true }),
          extractArgument(doc.text, { provider: deps.provider, apiKey: deps.apiKey }),
        ]);
        return {
          documentId:   doc.id,
          label:        doc.label,
          audit:        auditOut.audit,
          extraction:   extractionOut.result,
          inputTokens:  auditOut.inputTokens + extractionOut.inputTokens,
          outputTokens: auditOut.outputTokens + extractionOut.outputTokens,
        };
      }),
    );

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        documentAudits.push({
          documentId: r.value.documentId,
          label:      r.value.label,
          audit:      r.value.audit,
          extraction: r.value.extraction,
        });
        totalInputTokens  += r.value.inputTokens;
        totalOutputTokens += r.value.outputTokens;
      }
      // Failed documents are dropped — the synthesis runs on what succeeded.
    }
  }

  // ===== Stage B — cross-document synthesis =====
  let synthesis: CrossDocumentSynthesis | null = null;
  if (documentAudits.length >= 2) {
    try {
      const docsById = new Map(documents.map(d => [d.id, d]));
      const summaries = documentAudits.map((da) => {
        const doc = docsById.get(da.documentId)!;
        return {
          id:           da.documentId,
          label:        da.label,
          centralClaim: da.extraction.centralClaim,
          weakestLink:  da.audit.toulmin.weakestLink,
          topWarrants:  da.audit.toulmin.unstatedWarrants.slice(0, 3).map(w => w.warrant),
          fullText:     doc.text,
        };
      });

      const synResult = await callWithRetry(
        () =>
          deps.provider.complete(
            {
              operation:         'synthesize',
              model:             deps.proModel ?? CROSSDOC_SYNTHESIS_MODEL,
              systemInstruction: CROSSDOC_SYNTHESIS_SYSTEM_PROMPT,
              messages:          [{ role: 'user', content: buildCrossDocPrompt(summaries) }],
              responseFormat:    'json',
              thinkingBudget:    CROSSDOC_SYNTHESIS_THINKING_BUDGET,
            },
            deps.apiKey,
          ),
        CrossDocumentSynthesisSchema,
        'cross-document-synthesis',
        deps.backoffDelaysMs,
      );

      synthesis = filterValidEvidence(synResult.output, docsById);
      totalInputTokens  += synResult.inputTokens;
      totalOutputTokens += synResult.outputTokens;
    } catch {
      synthesis = null; // non-fatal — per-document audits still returned
    }
  }

  // Trim document text to a preview length in the returned payload (storage hygiene).
  const trimmedDocuments: DocumentInput[] = documents.map(d => ({
    ...d,
    text: d.text.slice(0, DOCUMENT_PREVIEW_CHARS),
  }));

  return {
    result: {
      documents:      trimmedDocuments,
      documentAudits,
      synthesis,
    },
    inputTokens:  totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
