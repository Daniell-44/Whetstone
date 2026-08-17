/**
 * The endpoint the extension calls. These tests exist because the path they
 * cover is the one that was broken: the pill reported success without checking
 * anything. Every rule below is a rule about telling the truth to the caller.
 */
import { describe, it, expect } from 'vitest';
import { handleMiniRequest, MIN_INPUT_CHARS, MAX_QUESTION_CHARS } from '../../functions/_lib/premise/handler';
import type { LlmProvider, ProxyResponse } from '../../functions/_lib/providers/types';
import type { MiniBriefing, MiniOutline } from '../../functions/_lib/premise/mini';

const provider: LlmProvider = {
  name: 'unused',
  async complete(): Promise<ProxyResponse> { throw new Error('should not be called'); },
};

const OUTLINE: MiniOutline = {
  question: 'Do reactors run 90 per cent of the time?',
  conclusion: 'It concludes they do.',
  claims: [{ claim: 'Nuclear reactors operate approximately 90 per cent of the time.', load: 'the cost case fails' }],
};

const LONG = 'a'.repeat(MIN_INPUT_CHARS + 10);

function deps(over: Partial<Parameters<typeof handleMiniRequest>[1]> = {}) {
  return {
    provider,
    geminiApiKey: 'k',
    dailyCap: 10,
    userDailyCap: 50,
    getSession: async () => null,
    runOutline: async () => ({ outline: OUTLINE, inTok: 1, outTok: 1 }),
    ...over,
  } as Parameters<typeof handleMiniRequest>[1];
}

const post = (body: unknown) =>
  new Request('https://x/api/extension/mini', { method: 'POST', body: JSON.stringify(body) });

describe('mini endpoint', () => {
  it('returns the outline for a long enough selection', async () => {
    const res = await handleMiniRequest(post({ text: LONG, trigger: 'selection' }), deps());
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; depth: string; outline: MiniOutline };
    expect(body.ok).toBe(true);
    expect(body.depth).toBe('outline');
    expect(body.outline.claims).toHaveLength(1);
  });

  it('refuses a selection too short to argue anything', async () => {
    const res = await handleMiniRequest(post({ text: 'too short', trigger: 'selection' }), deps());
    expect(res.status).toBe(400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('TOO_SHORT');
  });

  it('says so when the text rests on no checkable claim, rather than inventing one', async () => {
    const res = await handleMiniRequest(post({ text: LONG, trigger: 'article' }), deps({
      runOutline: async () => ({ outline: { question: '', conclusion: '', claims: [] }, inTok: 1, outTok: 1 }),
    }));
    expect(res.status).toBe(422);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('NO_CLAIMS');
  });

  it('reports a failed run as a failure instead of an empty success', async () => {
    // The bug being fixed: a caller must never be able to read "it worked" off
    // a response when it did not work.
    const res = await handleMiniRequest(post({ text: LONG, trigger: 'article', depth: 'full' }), deps({
      runFull: async () => { throw new Error('gemini exploded'); },
    }));
    expect(res.status).toBe(502);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RUN_FAILED');
  });

  it('meters the expensive depth and leaves the cheap one alone', async () => {
    // The outline is about a tenth of a cent; the full run is eight cents.
    // Charging a daily allowance for the free half would spend the user's quota
    // on the part that costs nothing.
    const seen: string[] = [];
    const kv = {
      async get(k: string) { seen.push(k); return null; },
      async put() { /* accept */ },
    };
    await handleMiniRequest(post({ text: LONG, trigger: 'article', depth: 'outline' }), deps({ rateLimitKv: kv }));
    expect(seen).toHaveLength(0);

    const briefing: MiniBriefing = {
      tier: 'none', question: '', conclusion: '', premises: [], opposing: [], limits: [],
      dropped: { unverified: 0, offClaim: 0 }, considered: [], attempts: [], fetchLedger: [],
      cost: { calls: 1, groundedCalls: 0, inputTokens: 0, outputTokens: 0, ms: 1 },
      timing: { outlineMs: 1, totalMs: 1 },
    };
    await handleMiniRequest(post({ text: LONG, trigger: 'article', depth: 'full' }), deps({
      rateLimitKv: kv, runFull: async () => briefing,
    }));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('mini:');
  });

  it('rejects a body that is not JSON', async () => {
    const req = new Request('https://x/api/extension/mini', { method: 'POST', body: 'not json' });
    const res = await handleMiniRequest(req, deps());
    expect(res.status).toBe(400);
  });

  it('refuses to pretend when the key is missing', async () => {
    const res = await handleMiniRequest(post({ text: LONG, trigger: 'article' }), deps({ geminiApiKey: undefined }));
    expect(res.status).toBe(503);
  });
});

/**
 * Question mode. A question is not an article: it is far shorter than the
 * article floor, and anything past a few hundred characters is a pasted
 * passage that the article path already handles better.
 */
describe('question mode', () => {
  const QUESTION = 'Is nuclear cheaper than renewables for Australia?';

  it('accepts a real question far below the article floor', async () => {
    expect(QUESTION.length).toBeLessThan(MIN_INPUT_CHARS);
    const res = await handleMiniRequest(post({ text: QUESTION, trigger: 'question' }), deps());
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; depth: string };
    expect(body.ok).toBe(true);
    expect(body.depth).toBe('outline');
  });

  it('still asks for a whole question, not a fragment', async () => {
    const res = await handleMiniRequest(post({ text: 'nuclear?', trigger: 'question' }), deps());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('TOO_SHORT');
  });

  it('refuses a pasted passage wearing a question mark', async () => {
    const res = await handleMiniRequest(
      post({ text: 'w'.repeat(MAX_QUESTION_CHARS + 1), trigger: 'question' }),
      deps(),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('TOO_LONG');
  });

  it('hands the question trigger to the outline run, which reframes the prompt', async () => {
    let seenTrigger: string | undefined;
    const res = await handleMiniRequest(post({ text: QUESTION, trigger: 'question' }), deps({
      runOutline: async (_text, d) => {
        seenTrigger = d.trigger;
        return { outline: OUTLINE, inTok: 1, outTok: 1 };
      },
    }));
    expect(res.status).toBe(200);
    expect(seenTrigger).toBe('question');
  });
});
