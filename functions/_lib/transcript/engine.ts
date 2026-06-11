import { callWithRetry } from '../llm/retry';
import { auditText } from '../audit/engine';
import { extractArgument } from '../argument-extraction/engine';
import { SegmentationResultSchema, CrossSegmentSynthesisSchema } from './schemas';
import { SEGMENTATION_SYSTEM_PROMPT, buildSegmentationPrompt, SYNTHESIS_SYSTEM_PROMPT, buildSynthesisPrompt } from './prompts';
import { cuesToText } from './youtube';
import {
  SEGMENT_MODEL, SEGMENT_THINKING_BUDGET,
  SYNTHESIS_MODEL, SYNTHESIS_THINKING_BUDGET,
  MAX_SEGMENTS_PER_TRANSCRIPT, MAX_PARALLEL_AUDITS, TRANSCRIPT_MAX_CHARS,
} from './constants';
import type {
  TranscriptInput, SegmentationResult, SegmentAudit,
  CrossSegmentSynthesis, TranscriptAuditResult, TranscriptAuditDeps,
  ArgumentSegment,
} from './types';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TranscriptAuditOutput {
  result:       TranscriptAuditResult;
  inputTokens:  number;
  outputTokens: number;
}

export async function auditTranscript(
  input: TranscriptInput,
  deps:  TranscriptAuditDeps,
): Promise<TranscriptAuditOutput> {
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;

  // ===== Stage A — segmentation =====
  const hasTimestamps = input.cues.some(c => c.endSec > 0);
  let transcriptText = cuesToText(input.cues, hasTimestamps);
  if (transcriptText.length > TRANSCRIPT_MAX_CHARS) {
    transcriptText = transcriptText.slice(0, TRANSCRIPT_MAX_CHARS) + '\n\n[Transcript truncated at character limit]';
  }

  const segResult = await callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.flashModel ?? SEGMENT_MODEL,
          systemInstruction: SEGMENTATION_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildSegmentationPrompt(transcriptText, hasTimestamps) }],
          responseFormat:    'json',
          thinkingBudget:    SEGMENT_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    SegmentationResultSchema,
    'transcript-segmentation',
    deps.backoffDelaysMs,
  );

  totalInputTokens  += segResult.inputTokens;
  totalOutputTokens += segResult.outputTokens;

  const segmentation: SegmentationResult = segResult.output;

  // Filter to argument segments and cap
  const argumentSegments: ArgumentSegment[] = segmentation.segments
    .filter(s => s.kind === 'argument')
    .slice(0, MAX_SEGMENTS_PER_TRANSCRIPT);

  // ===== Stage B — per-segment audit (parallel, throttled) =====
  const segmentAudits: SegmentAudit[] = [];

  for (let i = 0; i < argumentSegments.length; i += MAX_PARALLEL_AUDITS) {
    const batch = argumentSegments.slice(i, i + MAX_PARALLEL_AUDITS);
    const settled = await Promise.allSettled(
      batch.map(async (seg) => {
        const [auditOut, extractionOut] = await Promise.all([
          auditText(seg.text, {
            provider:      deps.provider,
            apiKey:        deps.apiKey,
            includePhase2: true,
          }),
          extractArgument(seg.text, {
            provider: deps.provider,
            apiKey:   deps.apiKey,
          }),
        ]);
        return {
          segmentId:   seg.id,
          audit:       auditOut.audit,
          extraction:  extractionOut.result,
          inputTokens: auditOut.inputTokens + extractionOut.inputTokens,
          outputTokens: auditOut.outputTokens + extractionOut.outputTokens,
        };
      }),
    );

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        segmentAudits.push({
          segmentId:  r.value.segmentId,
          audit:      r.value.audit,
          extraction: r.value.extraction,
        });
        totalInputTokens  += r.value.inputTokens;
        totalOutputTokens += r.value.outputTokens;
      }
      // Failed segments are silently dropped — the user gets the segments that succeeded
    }
  }

  // ===== Stage C — cross-segment synthesis =====
  let synthesis: CrossSegmentSynthesis | null = null;
  if (segmentAudits.length >= 2) {
    try {
      const summaries = segmentAudits.map(sa => {
        const seg = argumentSegments.find(s => s.id === sa.segmentId)!;
        return {
          id:           sa.segmentId,
          claimSummary: seg.claimSummary,
          weakestLink:  sa.audit.toulmin.weakestLink,
          topFallacies: sa.audit.namedFallacies.slice(0, 3).map(f => f.name),
          topWarrants:  sa.audit.toulmin.unstatedWarrants.slice(0, 2).map(w => w.warrant),
        };
      });

      const synResult = await callWithRetry(
        () =>
          deps.provider.complete(
            {
              operation:         'synthesize',
              model:             deps.proModel ?? SYNTHESIS_MODEL,
              systemInstruction: SYNTHESIS_SYSTEM_PROMPT,
              messages:          [{ role: 'user', content: buildSynthesisPrompt(summaries) }],
              responseFormat:    'json',
              thinkingBudget:    SYNTHESIS_THINKING_BUDGET,
            },
            deps.apiKey,
          ),
        CrossSegmentSynthesisSchema,
        'transcript-synthesis',
        deps.backoffDelaysMs,
      );

      synthesis = synResult.output;
      totalInputTokens  += synResult.inputTokens;
      totalOutputTokens += synResult.outputTokens;
    } catch {
      // Synthesis failure is non-fatal — we have per-segment audits regardless
      synthesis = null;
    }
  }

  return {
    result: {
      input,
      segmentation,
      segmentAudits,
      synthesis,
    },
    inputTokens:  totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
