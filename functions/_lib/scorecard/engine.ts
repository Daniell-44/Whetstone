import type { LlmProvider } from '../providers/types';
import type { Scorecard } from './types';
import { callWithRetry } from '../llm/retry';
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

// ---------------------------------------------------------------------------
// Engine deps
// ---------------------------------------------------------------------------

export interface EngineDeps {
  provider:        LlmProvider;
  apiKey:          string;
  /** Override the Stage 1 model (default: POSITION_SYNTHESIS_MODEL). */
  stage1Model?:    string;
  /** Override the Stage 2 model (default: META_ANALYSIS_MODEL). */
  stage2Model?:    string;
  /**
   * Backoff delays (ms) between overload retry attempts. Three entries → 4
   * total attempts. Override with near-zero values in tests.
   */
  backoffDelaysMs?: readonly number[];
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
  deps: EngineDeps,
): Promise<PositionSynthesisResult> {
  return callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'analyze',
          model:             deps.stage1Model ?? POSITION_SYNTHESIS_MODEL,
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
    deps.backoffDelaysMs,
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
  deps: EngineDeps,
): Promise<MetaAnalysisResult> {
  return callWithRetry(
    () =>
      deps.provider.complete(
        {
          operation:         'synthesize',
          model:             deps.stage2Model ?? META_ANALYSIS_MODEL,
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
    deps.backoffDelaysMs,
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
  deps: EngineDeps,
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
