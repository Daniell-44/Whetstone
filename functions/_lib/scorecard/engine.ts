import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import type { Scorecard } from './types';
import {
  DebateInputSchema,
  Stage1OutputSchema,
  Stage2OutputSchema,
  type DebateInput,
  type Stage1Output,
} from './schemas';
import {
  POSITION_SYNTHESIS_SYSTEM_PROMPT,
  buildPositionSynthesisPrompt,
  META_ANALYSIS_SYSTEM_PROMPT,
  buildMetaAnalysisPrompt,
} from './prompts';
import {
  POSITION_SYNTHESIS_MODEL,
  META_ANALYSIS_MODEL,
  POSITION_SYNTHESIS_TEMPERATURE,
  META_ANALYSIS_TEMPERATURE,
  POSITION_SYNTHESIS_MAX_TOKENS,
  META_ANALYSIS_MAX_TOKENS,
  POSITION_SYNTHESIS_THINKING_BUDGET,
  META_ANALYSIS_THINKING_BUDGET,
} from './constants';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

function extractJson(text: string): string {
  // Strip markdown code fences if the model added them despite JSON mode.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced ? fenced[1] : text.trim();
}

// ---------------------------------------------------------------------------
// Retry helper — attempts the call twice; throws on second validation failure.
// ---------------------------------------------------------------------------

interface CallResult<T> {
  output:       T;
  inputTokens:  number;
  outputTokens: number;
}

async function callWithRetry<T>(
  makeRequest: () => Promise<{ content: string; inputTokens: number; outputTokens: number }>,
  schema: z.ZodType<T>,
  stageName: string,
): Promise<CallResult<T>> {
  let lastError = 'unknown';

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await makeRequest();
    try {
      const parsed = schema.safeParse(JSON.parse(extractJson(res.content)));
      if (parsed.success) {
        return {
          output:       parsed.data,
          inputTokens:  res.inputTokens,
          outputTokens: res.outputTokens,
        };
      }
      lastError = parsed.error.message;
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'JSON parse error';
    }
  }

  throw new Error(`Stage "${stageName}" failed validation after 2 attempts: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Stage 1 — synthesise one position
// ---------------------------------------------------------------------------

interface PositionSynthesisResult {
  output:       Stage1Output;
  inputTokens:  number;
  outputTokens: number;
}

async function synthesisePosition(
  position: DebateInput['positions'][number],
  deps: { provider: LlmProvider; apiKey: string },
): Promise<PositionSynthesisResult> {
  return callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             POSITION_SYNTHESIS_MODEL,
          systemInstruction: POSITION_SYNTHESIS_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildPositionSynthesisPrompt(position) }],
          responseFormat:    'json',
          temperature:       POSITION_SYNTHESIS_TEMPERATURE,
          maxTokens:         POSITION_SYNTHESIS_MAX_TOKENS,
          thinkingBudget:    POSITION_SYNTHESIS_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    Stage1OutputSchema,
    `position-synthesis[${position.label}]`,
  );
}

// ---------------------------------------------------------------------------
// Stage 2 — meta-analysis across all positions
// ---------------------------------------------------------------------------

interface MetaAnalysisResult {
  output:       { dek: string; bridgingWarrant: string; explanation: string };
  inputTokens:  number;
  outputTokens: number;
}

async function runMetaAnalysis(
  question: string,
  syntheses: Array<{ label: string; synthesis: Stage1Output }>,
  deps: { provider: LlmProvider; apiKey: string },
): Promise<MetaAnalysisResult> {
  return callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'synthesize',
          model:             META_ANALYSIS_MODEL,
          systemInstruction: META_ANALYSIS_SYSTEM_PROMPT,
          messages:          [{ role: 'user', content: buildMetaAnalysisPrompt(question, syntheses) }],
          responseFormat:    'json',
          temperature:       META_ANALYSIS_TEMPERATURE,
          maxTokens:         META_ANALYSIS_MAX_TOKENS,
          thinkingBudget:    META_ANALYSIS_THINKING_BUDGET,
        },
        deps.apiKey,
      ),
    Stage2OutputSchema,
    'meta-analysis',
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateScorecardResult {
  scorecard: Scorecard;
  usage:     { inputTokens: number; outputTokens: number };
}

export async function generateScorecard(
  input: DebateInput,
  deps: { provider: LlmProvider; apiKey: string },
): Promise<GenerateScorecardResult> {
  // Validate input at the boundary.
  const validated = DebateInputSchema.safeParse(input);
  if (!validated.success) {
    throw new Error(`Invalid DebateInput: ${validated.error.message}`);
  }
  const debate = validated.data;

  // Stage 1: synthesise all positions in parallel.
  const stage1Results = await Promise.all(
    debate.positions.map((pos) => synthesisePosition(pos, deps)),
  );

  // Stage 2: meta-analysis, informed by all Stage 1 outputs.
  const stage2Result = await runMetaAnalysis(
    debate.question,
    debate.positions.map((pos, i) => ({
      label:     pos.label,
      synthesis: stage1Results[i].output,
    })),
    deps,
  );

  // Assemble the final Scorecard. Sources come directly from input — never LLM-generated.
  const scorecard: Scorecard = {
    slug:          slugify(debate.question),
    question:      debate.question,
    dek:           stage2Result.output.dek,
    publishedDate: new Date().toISOString().split('T')[0],
    positions:     debate.positions.map((pos, i) => ({
      label:     pos.label,
      bestCase:  stage1Results[i].output.bestCase,
      fatalFlaw: stage1Results[i].output.fatalFlaw,
      sources:   pos.articles.map((a) => ({
        title:       a.title,
        publication: a.publication,
        url:         a.url,
      })),
    })),
    metaAnalysis: {
      bridgingWarrant: stage2Result.output.bridgingWarrant,
      explanation:     stage2Result.output.explanation,
    },
  };

  const usage = {
    inputTokens:
      stage1Results.reduce((s, r) => s + r.inputTokens, 0) + stage2Result.inputTokens,
    outputTokens:
      stage1Results.reduce((s, r) => s + r.outputTokens, 0) + stage2Result.outputTokens,
  };

  return { scorecard, usage };
}
