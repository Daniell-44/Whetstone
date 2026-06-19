import { describe, it, expect } from 'vitest';
import { handleExtractionRequest } from '../../functions/_lib/argument-extraction/handler';
import type { ExtractionHandlerDeps } from '../../functions/_lib/argument-extraction/handler';
import type { LlmProvider } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_RESULT_JSON = JSON.stringify({
  centralClaim: 'Test claim.',
  statements:   [],
  notes:        null,
  confidence:   85,
});

function makeProvider(content = VALID_RESULT_JSON): LlmProvider {
  return {
    name:     'mock',
    complete: async () => ({ content, inputTokens: 50, outputTokens: 20 }),
  };
}

function makeDeps(overrides: Partial<ExtractionHandlerDeps> = {}): ExtractionHandlerDeps {
  return {
    rateLimitKv:        undefined,
    geminiApiKey:       'test-key',
    extractionDailyCap: 10,
    provider:           makeProvider(),
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request('https://test.example/api/extract-argument', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleExtractionRequest', () => {
  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('https://test.example/api/extract-argument', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'not-json',
    });
    const res  = await handleExtractionRequest(req, makeDeps());
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when text is too short', async () => {
    const res  = await handleExtractionRequest(makeRequest({ text: 'short' }), makeDeps());
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 503 when geminiApiKey is missing', async () => {
    const text = 'a'.repeat(60);
    const res  = await handleExtractionRequest(makeRequest({ text }), makeDeps({ geminiApiKey: undefined }));
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(503);
    expect(data.error.code).toBe('EXTRACTION_FAILED');
  });

  it('returns ok result for valid text', async () => {
    const text = 'a'.repeat(60);
    const res  = await handleExtractionRequest(makeRequest({ text }), makeDeps());
    const data = await res.json() as { ok: boolean; extraction: unknown };
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.extraction).toBeDefined();
  });

  it('applies per-user rate limit when user is logged in', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const text  = 'a'.repeat(60);
    const deps  = makeDeps({
      rateLimitKv: {
        get: async () => JSON.stringify({ count: 50, period: today }),
        put: async () => {},
      } as unknown as ExtractionHandlerDeps['rateLimitKv'],
      extractionUserDailyCap: 50,
      getSession: async () => ({ userId: 'u-1' }),
    });
    const res  = await handleExtractionRequest(makeRequest({ text }), deps);
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('RATE_LIMITED');
  });
});
