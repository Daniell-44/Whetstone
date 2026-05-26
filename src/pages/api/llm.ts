// ZERO-RETENTION POLICY
// This function is a thin relay. It adds the server-held API key and returns the
// provider response. It never logs, stores, or inspects request content (prompts,
// completions, or user text). KV stores only rate-limit counters: { count, day }.
// Zero Data Retention (ZDR) with the upstream provider is enforced contractually —
// see BUILD_BRIEF.md §4 for the non-code step Daniel completes separately before
// public launch.

export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { GeminiProvider }   from '../../../functions/_lib/providers/gemini';
import { AnthropicProvider } from '../../../functions/_lib/providers/anthropic';
import { estimateCost }      from '../../../functions/_lib/providers/pricing';
import { ProviderError }     from '../../../functions/_lib/providers/types';
import type { LlmProvider }  from '../../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const ProxyRequestSchema = z.object({
  operation:         z.enum(['triage', 'analyze', 'synthesize']),
  model:             z.string().min(1),
  systemInstruction: z.string(),
  messages:          z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1),
  responseFormat:    z.enum(['json', 'text']),
  maxTokens:         z.number().int().positive().optional(),
  temperature:       z.number().min(0).max(2).optional(),
  thinkingBudget:    z.number().int().min(0).optional(),
  providerOverride:  z.enum(['gemini', 'anthropic']).optional(),
});

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

const PROVIDERS: Record<string, LlmProvider> = {
  gemini:    new GeminiProvider(),
  anthropic: new AnthropicProvider(),
};

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

interface QuotaRecord {
  count: number;
  day:   string; // YYYY-MM-DD UTC
}

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrementQuota(
  kv:  KVNamespace,
  key: string,
  cap: number,
): Promise<{ allowed: boolean; resetAt: string }> {
  const today  = utcDateString();
  const raw    = await kv.get(key);
  const record: QuotaRecord = raw
    ? (JSON.parse(raw) as QuotaRecord)
    : { count: 0, day: today };

  if (record.day !== today) {
    record.count = 0;
    record.day   = today;
  }

  const resetAt = `${today}T23:59:59Z`;

  if (record.count >= cap) {
    return { allowed: false, resetAt };
  }

  record.count++;
  // TTL 90000s (~25 h) so stale keys expire naturally before the following day.
  await kv.put(key, JSON.stringify(record), { expirationTtl: 90000 });

  return { allowed: true, resetAt };
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

function getAllowedOrigins(): Set<string> {
  return new Set(
    (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  );
}

function corsHeaders(origin: string | null, allowed: Set<string>): Record<string, string> {
  const allowedOrigin = origin && allowed.has(origin) ? origin : '';
  if (!allowedOrigin) return {};
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Id, X-Cost-Test',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const OPTIONS: APIRoute = async ({ request }) => {
  const origin = request.headers.get('Origin');
  const cors   = corsHeaders(origin, getAllowedOrigins());
  return new Response(null, { status: 204, headers: cors });
};

export const POST: APIRoute = async ({ request }) => {
  const origin  = request.headers.get('Origin');
  const allowed = getAllowedOrigins();
  const cors    = corsHeaders(origin, allowed);

  // ---------------------------------------------------------------------------
  // Rate limiting — device UUID (soft) then IP backstop (harder).
  // ---------------------------------------------------------------------------

  const cap      = parseInt(env.FREE_TIER_DAILY_CAP ?? '25', 10);
  const deviceId = request.headers.get('X-Device-Id');
  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')  ??
    'unknown';

  if (env.RATE_LIMIT) {
    if (deviceId) {
      const deviceQuota = await checkAndIncrementQuota(env.RATE_LIMIT, `device:${deviceId}`, cap);
      if (!deviceQuota.allowed) {
        return json({ error: 'quota_exceeded', resetAt: deviceQuota.resetAt }, 429, cors);
      }
    }

    // IP backstop uses a 5× cap to avoid false positives on shared IPs (offices, NAT).
    const ipQuota = await checkAndIncrementQuota(env.RATE_LIMIT, `ip:${ip}`, cap * 5);
    if (!ipQuota.allowed) {
      return json({ error: 'quota_exceeded', resetAt: ipQuota.resetAt }, 429, cors);
    }
  }

  // ---------------------------------------------------------------------------
  // Parse and validate body
  // ---------------------------------------------------------------------------

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON' }, 400, cors);
  }

  const parsed = ProxyRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'bad_request', message: 'Validation failed' }, 400, cors);
  }

  const req = parsed.data;

  // ---------------------------------------------------------------------------
  // Provider selection
  // X-Cost-Test override is only honoured when the header value matches
  // COST_TEST_SECRET — used for local cost-comparison testing.
  // ---------------------------------------------------------------------------

  let providerName = env.LLM_PROVIDER ?? 'gemini';

  const costTestHeader = request.headers.get('X-Cost-Test');
  if (
    costTestHeader &&
    env.COST_TEST_SECRET &&
    costTestHeader === env.COST_TEST_SECRET &&
    req.providerOverride
  ) {
    providerName = req.providerOverride;
  }

  const provider = PROVIDERS[providerName];
  if (!provider) {
    return json({ error: 'provider_error', message: 'Unknown provider' }, 500, cors);
  }

  // ---------------------------------------------------------------------------
  // API key lookup — never echoed back to the client
  // ---------------------------------------------------------------------------

  const apiKey = providerName === 'anthropic'
    ? env.ANTHROPIC_API_KEY
    : env.GEMINI_API_KEY;

  if (!apiKey) {
    return json({ error: 'provider_error', message: 'Service unavailable' }, 503, cors);
  }

  // ---------------------------------------------------------------------------
  // Call provider
  // ---------------------------------------------------------------------------

  let result: { content: string; inputTokens: number; outputTokens: number };
  try {
    result = await provider.complete(req, apiKey);
  } catch (err) {
    if (err instanceof ProviderError) {
      const status =
        err.kind === 'rate_limited' ? 429 :
        err.kind === 'bad_request'  ? 400 : 502;
      return json({ error: err.kind, message: 'Upstream error' }, status, cors);
    }
    return json({ error: 'provider_error', message: 'Upstream error' }, 502, cors);
  }

  // ---------------------------------------------------------------------------
  // Cost logging — token counts only, never content
  // ---------------------------------------------------------------------------

  const estimatedCostUsd = estimateCost(req.model, result.inputTokens, result.outputTokens);
  console.log(JSON.stringify({
    provider:        provider.name,
    model:           req.model,
    operation:       req.operation,
    inputTokens:     result.inputTokens,
    outputTokens:    result.outputTokens,
    estimatedCostUsd,
  }));

  return json(
    { content: result.content, inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    200,
    cors,
  );
};
