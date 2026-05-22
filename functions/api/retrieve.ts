import { GeminiClient } from '../_lib/gemini';
import { RetrieveRequestSchema, CitationResultSchema } from '../_lib/schema';
import type { RetrievedSource } from '../_lib/schema';
import { CITATION_SYSTEM_PROMPT, citationUserPrompt } from '../_lib/prompts';

const TIER2_MODEL = 'gemini-2.5-flash-lite';
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const FORBIDDEN_WORDS = ['misinformation', 'propaganda', 'bias', 'lies', 'fake', 'fact-check', 'debunk', 'consumer'];
const MIN_SOURCES = 2;
const MAX_SOURCES = 4;
const HEAD_TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Per-IP rate limit — in-memory, acceptable for this stage.
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
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
// Cloudflare Pages Function context types
// ---------------------------------------------------------------------------

interface Env {
  GEMINI_API_KEY: string;
  TAVILY_API_KEY: string;
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
// Validation helpers
// ---------------------------------------------------------------------------

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function hasForbiddenWord(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some((w) => lower.includes(w));
}

async function headCheck(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return r.status >= 200 && r.status < 300;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tavily wire types
// ---------------------------------------------------------------------------

interface TavilyResult {
  url:     string;
  title:   string;
  content: string;
  score:   number;
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

  const parsed = RetrieveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'validation_failed', details: parsed.error.format() }, 400);
  }

  const { claimText } = parsed.data;
  const geminiKey = env.GEMINI_API_KEY;
  const tavilyKey = env.TAVILY_API_KEY;

  // Missing keys → vendor unavailable from the user's perspective
  if (!geminiKey || !tavilyKey) {
    return json({ error: 'lookup_unavailable' });
  }

  // Step 1 — Tavily search
  let tavilyResults: TavilyResult[];
  try {
    const tavilyRes = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:              tavilyKey,
        query:                claimText,
        search_depth:         'basic',
        include_answer:       false,
        include_raw_content:  false,
        max_results:          6,
      }),
    });

    // Any Tavily non-2xx (429 rate-limit, 402/403 quota, 5xx) → unavailable
    if (!tavilyRes.ok) {
      return json({ error: 'lookup_unavailable' });
    }

    const tavilyData = (await tavilyRes.json()) as { results?: TavilyResult[] };
    tavilyResults = tavilyData.results ?? [];
  } catch {
    // Network error reaching Tavily
    return json({ error: 'lookup_unavailable' });
  }

  // Empty Tavily results → content not found, not a vendor error
  if (tavilyResults.length === 0) {
    return json({ sources: [] });
  }

  const tavilyUrlSet = new Set(tavilyResults.map((r) => r.url));

  // Step 2 — Gemini citation classification
  const gemini = new GeminiClient(geminiKey);
  let citations: Array<{ url: string; stance: string; quote: string; description: string }>;

  try {
    const sources = tavilyResults.map((r) => ({
      url:     r.url,
      title:   r.title,
      content: r.content,
    }));

    const resp = await gemini.complete({
      model:             TIER2_MODEL,
      systemInstruction: CITATION_SYSTEM_PROMPT,
      messages:          [{ role: 'user', content: citationUserPrompt(claimText, sources) }],
      maxTokens:         2048,
      temperature:       0,
      responseSchema:    CitationResultSchema,
    });

    const citParsed = CitationResultSchema.safeParse(JSON.parse(resp.content));
    if (!citParsed.success) return json({ error: 'lookup_unavailable' });
    citations = citParsed.data.citations;
  } catch {
    // Gemini rate-limit, safety block, or network error
    return json({ error: 'lookup_unavailable' });
  }

  // Step 3 — Validate each citation
  const validated: RetrievedSource[] = [];
  let validationDropped = 0;

  for (const cit of citations) {
    if (validated.length >= MAX_SOURCES) break;

    // URL must originate from Tavily — prevents hallucination
    if (!tavilyUrlSet.has(cit.url)) {
      validationDropped++;
      continue;
    }

    const tavilySource = tavilyResults.find((r) => r.url === cit.url);
    if (!tavilySource) {
      validationDropped++;
      continue;
    }

    // Quote must appear verbatim in source content
    if (!normalizeWs(tavilySource.content).includes(normalizeWs(cit.quote))) {
      validationDropped++;
      continue;
    }

    if (hasForbiddenWord(cit.description)) {
      validationDropped++;
      continue;
    }

    const alive = await headCheck(cit.url);
    if (!alive) {
      validationDropped++;
      continue;
    }

    validated.push({
      url:         cit.url,
      title:       tavilySource.title,
      description: cit.description,
      stance:      cit.stance as 'supports' | 'contradicts' | 'context',
      quote:       cit.quote,
    });
  }

  // Silence over partial unreliable output — <2 valid → return empty
  if (validated.length < MIN_SOURCES) {
    return json({ sources: [], meta: { validationDropped } });
  }

  return json({ sources: validated, meta: { validationDropped } });
};
