import { GeminiClient } from '../_lib/gemini';
import {
  ApiRequestSchema,
  AnalysisResultSchema,
  CreatorAnalysisResultSchema,
  TriageResultSchema,
  type AnalysisResult,
  type CreatorAnalysisResult,
} from '../_lib/schema';
import {
  TRIAGE_SYSTEM_PROMPT,
  triageUserPrompt,
  buildAnalysisSystemPrompt,
  analysisUserPrompt,
} from '../_lib/prompts';

const TIER1_MODEL = 'gemini-2.5-flash';
const TIER2_MODEL = 'gemini-2.5-flash-lite';
const CONFIDENCE_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Per-IP rate limit — in-memory, acceptable for this stage.
// DUPLICATED intent: replace with KV-backed rate limit before public launch.
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

// ---------------------------------------------------------------------------
// Cloudflare Pages Function context types (defined inline to avoid @cloudflare/workers-types dep)
// ---------------------------------------------------------------------------

interface Env {
  GEMINI_API_KEY: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;

  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For') ??
    'unknown';

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return json({ error: 'rate_limited', retryAfterSeconds: rateCheck.retryAfterSeconds }, 429);
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

  // Tier 1 — triage
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

  // Tier 2 — full analysis
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
