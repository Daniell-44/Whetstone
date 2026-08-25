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

// ---------------------------------------------------------------------------
// Stage A on its own.
//
// Split out of auditTranscript on 2026-08-25 (owner call: "transcript pulls
// cost money"). A whole-transcript run is one segmentation call plus up to
// twelve per-segment audits plus a gemini-2.5-pro synthesis, roughly ten to
// twenty times the cost of auditing one article. Segmentation alone is a
// single Flash call, and it is the only genuinely transcript-shaped step:
// once a segment is chosen its text is just text, and the ordinary audit
// handles it. So the reader gets the map for a fraction of a cent and spends
// a real audit only on the segment they actually care about.
//
// auditTranscript still calls this, so the whole-transcript path is unchanged.
// ---------------------------------------------------------------------------
export interface SegmentationOutput {
  segmentation:     SegmentationResult;
  argumentSegments: ArgumentSegment[];
  inputTokens:      number;
  outputTokens:     number;
}

export async function segmentTranscript(
  input: TranscriptInput,
  deps:  TranscriptAuditDeps,
): Promise<SegmentationOutput> {
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

  const segmentation: SegmentationResult = segResult.output;

  return {
    segmentation,
    // Argument segments only, capped. The other kinds (sponsor reads, intros,
    // listener mail) are what makes an hour of audio mostly not an argument.
    argumentSegments: segmentation.segments
      .filter(s => s.kind === 'argument')
      .slice(0, MAX_SEGMENTS_PER_TRANSCRIPT),
    inputTokens:  segResult.inputTokens,
    outputTokens: segResult.outputTokens,
  };
}

export async function auditTranscript(
  input: TranscriptInput,
  deps:  TranscriptAuditDeps,
): Promise<TranscriptAuditOutput> {
  // ===== Stage A - segmentation =====
  const stageA = await segmentTranscript(input, deps);
  const { segmentation, argumentSegments } = stageA;
  let totalInputTokens  = stageA.inputTokens;
  let totalOutputTokens = stageA.outputTokens;

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
