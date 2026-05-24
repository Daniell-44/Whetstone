import { z } from 'zod';
import type { LlmProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Retry helper
//
// Three failure modes, treated differently:
//   1. Retryable provider error (5xx overload, rate-limit, network) →
//      retry up to 4 times with exponential backoff (~2s / 6s / 15s).
//   2. Malformed / invalid JSON from the model →
//      retry once immediately (same as before).
//   3. Hard error (4xx, bad request, auth) → fail fast, no retry.
//
// backoffDelaysMs is the wait before each successive overload attempt.
// Three entries → 4 total attempts (first + 3 retries). Override in tests
// with near-zero values so the suite stays fast.
// ---------------------------------------------------------------------------

const DEFAULT_BACKOFF_DELAYS_MS = [2_000, 6_000, 15_000] as const;

interface CallResult<T> {
  output:       T;
  inputTokens:  number;
  outputTokens: number;
}

async function callWithRetry<T>(
  makeRequest: () => Promise<{ content: string; inputTokens: number; outputTokens: number }>,
  schema: z.ZodType<T>,
  stageName: string,
  backoffDelaysMs: readonly number[] = DEFAULT_BACKOFF_DELAYS_MS,
): Promise<CallResult<T>> {
  const maxAttempts = backoffDelaysMs.length + 1;
  let lastRetryableError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before each retry (never before the first attempt).
    if (attempt > 0) {
      await sleep(backoffDelaysMs[attempt - 1]!);
    }

    let lastValidationError = 'unknown';

    // Inner loop: try the request, then validate JSON.
    // Retries once immediately on bad model output (no delay).
    for (let jsonAttempt = 0; jsonAttempt < 2; jsonAttempt++) {
      let res: { content: string; inputTokens: number; outputTokens: number };
      try {
        res = await makeRequest();
      } catch (err) {
        if (err instanceof ProviderError && err.retryable) {
          // Retryable provider error — break inner loop and continue outer with backoff.
          lastRetryableError = err;
          break;
        }
        // Hard error (4xx, safety block, etc.) — propagate immediately.
        throw err;
      }

      // Request succeeded; parse and validate the JSON output.
      try {
        const parsed = schema.safeParse(JSON.parse(extractJson(res.content)));
        if (parsed.success) {
          return { output: parsed.data, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
        }
        lastValidationError = parsed.error.message;
      } catch (e) {
        lastValidationError = e instanceof Error ? e.message : 'JSON parse error';
      }

      // After the second JSON attempt, give up — two consecutive bad outputs
      // indicate a persistent model problem, not a transient one.
      if (jsonAttempt === 1) {
        throw new Error(
          `Stage "${stageName}" failed JSON validation after 2 attempts: ${lastValidationError}`,
        );
      }
      // jsonAttempt === 0: immediately retry the request (no delay) for bad output.
    }
  }

  // All backoff attempts exhausted.
  if (lastRetryableError instanceof ProviderError) {
    throw new ProviderError(
      lastRetryableError.kind,
      `Stage "${stageName}" failed after ${maxAttempts} attempts (last: ${lastRetryableError.message})`,
      lastRetryableError.status,
      false,
    );
  }
  throw new Error(`Stage "${stageName}" exhausted all ${maxAttempts} retry attempts`);
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
