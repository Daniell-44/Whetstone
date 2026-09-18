export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { checkAndIncrementQuota, quotaIdentity } from '../../../functions/_lib/rate-limit';
import { GeminiClient } from '../../../functions/_lib/gemini';
import {
  ApiRequestSchema,
  AnalysisResultSchema,
  CreatorAnalysisResultSchema,
  TriageResultSchema,
  type AnalysisResult,
  type CreatorAnalysisResult,
} from '../../../functions/_lib/schema';
import {
  TRIAGE_SYSTEM_PROMPT,
  triageUserPrompt,
  buildAnalysisSystemPrompt,
  analysisUserPrompt,
} from '../../../functions/_lib/prompts';

const TIER1_MODEL = 'gemini-2.5-flash';
const TIER2_MODEL = 'gemini-2.5-flash-lite';
const CONFIDENCE_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Per-caller rate limit, 10/hour.
//
// This was a module-level Map. Worker isolates are per-colo and short-lived,
// so that state was neither shared nor durable — in production it meant no
// effective limit at all on an endpoint that spends model tokens. KV is shared
// across isolates, so the cap is now real.
//
// If KV is unbound (local dev without the binding) the request proceeds rather
// than failing closed: this endpoint has no in-repo caller left, and a hard
// failure here would be a worse dev experience than an unmetered local call.
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (env.RATE_LIMIT) {
    const quota = await checkAndIncrementQuota(
      env.RATE_LIMIT,
      `analyze:${quotaIdentity(request)}`,
      RATE_LIMIT_MAX,
      'rolling1h',
    );
    if (!quota.allowed) {
      return json({
        error:             'rate_limited',
        retryAfterSeconds: Math.max(0, Math.ceil((Date.parse(quota.resetAt) - Date.now()) / 1000)),
      }, 429);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const parsed = ApiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'validation_failed', details: parsed.error.format() }, 400);
  }

  const { text, mode } = parsed.data;
  const isCreator = mode === 'creator';
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return json({ error: 'service_unavailable' }, 503);
  }

  const client = new GeminiClient(apiKey);

  // Tier 1 - triage
  let isArgument: boolean;
  try {
    const triageResponse = await client.complete({
      model: TIER1_MODEL,
      systemInstruction: TRIAGE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: triageUserPrompt(text) }],
      maxTokens: 256,
      temperature: 0,
      thinkingBudget: 0,
      responseSchema: TriageResultSchema,
    });

    const triageParsed = TriageResultSchema.safeParse(JSON.parse(triageResponse.content));
    if (!triageParsed.success) throw new Error('Triage validation failed');
    isArgument = triageParsed.data.isArgument;
  } catch (err) {
    console.error('[analyze] triage failed:', err);
    return json({ error: 'analysis_failed', message: 'Triage step failed' }, 500);
  }

  if (!isArgument) {
    return json({
      kind: 'not_an_argument',
      reason: 'The tool did not find a substantive argument in this text.',
    });
  }

  // Tier 2 - full analysis
  try {
    const schema = isCreator ? CreatorAnalysisResultSchema : AnalysisResultSchema;
    const analysisResponse = await client.complete({
      model: TIER2_MODEL,
      systemInstruction: buildAnalysisSystemPrompt(isCreator),
      messages: [{ role: 'user', content: analysisUserPrompt(text) }],
      maxTokens: 8192,
      temperature: 0.2,
      responseSchema: schema,
    });

    const raw = JSON.parse(analysisResponse.content) as unknown;

    if (isCreator) {
      const analysisParsed = CreatorAnalysisResultSchema.safeParse(raw);
      if (!analysisParsed.success) throw new Error('Analysis validation failed');

      const result: CreatorAnalysisResult = {
        ...analysisParsed.data,
        fallacies: analysisParsed.data.fallacies.filter((f) => f.confidence >= CONFIDENCE_THRESHOLD),
        blindSpotCounterarguments: (analysisParsed.data.blindSpotCounterarguments ?? [])
          .filter((b) => b.confidence >= CONFIDENCE_THRESHOLD),
      };

      return json({ kind: 'result', result });
    } else {
      const analysisParsed = AnalysisResultSchema.safeParse(raw);
      if (!analysisParsed.success) throw new Error('Analysis validation failed');

      const result: AnalysisResult = {
        ...analysisParsed.data,
        fallacies: analysisParsed.data.fallacies.filter((f) => f.confidence >= CONFIDENCE_THRESHOLD),
      };

      return json({ kind: 'result', result });
    }
  } catch (err) {
    console.error('[analyze] analysis failed:', err);
    return json({ error: 'analysis_failed', message: 'Analysis step failed' }, 500);
  }
};
