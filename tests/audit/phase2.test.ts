import { describe, it, expect } from 'vitest';
import { keyTermMatchKey, referentMatchKey, falsifiabilityMatchKey } from '../../functions/_lib/audit/match-keys';
import { buildSystemPrompt } from '../../functions/_lib/audit/prompts';
import { handleAuditRequest } from '../../functions/_lib/audit/handler';
import type { AuditHandlerDeps } from '../../functions/_lib/audit/handler';
import type { LlmProvider, ProxyRequest } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// Match-key functions
// ---------------------------------------------------------------------------

describe('keyTermMatchKey', () => {
  it('produces a stable key for the same term and issue', () => {
    const a = keyTermMatchKey({ term: 'freedom', issue: 'stipulative-smuggling' });
    const b = keyTermMatchKey({ term: 'freedom', issue: 'stipulative-smuggling' });
    expect(a).toBe(b);
  });

  it('normalises punctuation and case', () => {
    const a = keyTermMatchKey({ term: 'Freedom!', issue: 'stipulative-smuggling' });
    const b = keyTermMatchKey({ term: 'freedom',  issue: 'stipulative-smuggling' });
    expect(a).toBe(b);
  });

  it('differs when the issue differs', () => {
    const a = keyTermMatchKey({ term: 'freedom', issue: 'stipulative-smuggling' });
    const b = keyTermMatchKey({ term: 'freedom', issue: 'cross-language-game-equivocation' });
    expect(a).not.toBe(b);
  });

  it('differs when the term differs', () => {
    const a = keyTermMatchKey({ term: 'freedom', issue: 'stipulative-smuggling' });
    const b = keyTermMatchKey({ term: 'liberty', issue: 'stipulative-smuggling' });
    expect(a).not.toBe(b);
  });

  it('starts with "keyterm:" prefix', () => {
    expect(keyTermMatchKey({ term: 'X', issue: 'empty-referent' })).toMatch(/^keyterm:/);
  });
});

describe('referentMatchKey', () => {
  it('produces a stable key for the same phrase and issue', () => {
    const a = referentMatchKey({ phrase: 'real Americans', issue: 'empty-referent' });
    const b = referentMatchKey({ phrase: 'real Americans', issue: 'empty-referent' });
    expect(a).toBe(b);
  });

  it('normalises whitespace differences', () => {
    const a = referentMatchKey({ phrase: 'real  Americans', issue: 'empty-referent' });
    const b = referentMatchKey({ phrase: 'real Americans',  issue: 'empty-referent' });
    expect(a).toBe(b);
  });

  it('differs when the issue differs', () => {
    const a = referentMatchKey({ phrase: 'the establishment', issue: 'vague-proper-name' });
    const b = referentMatchKey({ phrase: 'the establishment', issue: 'failed-presupposition' });
    expect(a).not.toBe(b);
  });

  it('starts with "referent:" prefix', () => {
    expect(referentMatchKey({ phrase: 'X', issue: 'empty-referent' })).toMatch(/^referent:/);
  });
});

describe('falsifiabilityMatchKey', () => {
  it('produces a stable key for the same claim and issue', () => {
    const a = falsifiabilityMatchKey({ claim: 'True leaders always decide correctly.', issue: 'circular-truth-conditions' });
    const b = falsifiabilityMatchKey({ claim: 'True leaders always decide correctly.', issue: 'circular-truth-conditions' });
    expect(a).toBe(b);
  });

  it('normalises case and punctuation', () => {
    const a = falsifiabilityMatchKey({ claim: 'True leaders always decide correctly!', issue: 'circular-truth-conditions' });
    const b = falsifiabilityMatchKey({ claim: 'true leaders always decide correctly',  issue: 'circular-truth-conditions' });
    expect(a).toBe(b);
  });

  it('differs when the issue differs', () => {
    const a = falsifiabilityMatchKey({ claim: 'The policy works.', issue: 'no-truth-conditions' });
    const b = falsifiabilityMatchKey({ claim: 'The policy works.', issue: 'circular-truth-conditions' });
    expect(a).not.toBe(b);
  });

  it('starts with "falsifiability:" prefix', () => {
    expect(falsifiabilityMatchKey({ claim: 'X', issue: 'no-truth-conditions' })).toMatch(/^falsifiability:/);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt — includePhase2 flag
// ---------------------------------------------------------------------------

describe('buildSystemPrompt', () => {
  it('omits Phase-2 sections when includePhase2 is false', () => {
    const prompt = buildSystemPrompt(false);
    expect(prompt).not.toContain('keyTermScrutiny');
    expect(prompt).not.toContain('referentChecks');
    expect(prompt).not.toContain('falsifiabilityChecks');
    expect(prompt).not.toContain('Wittgenstein');
    expect(prompt).not.toContain('Russell');
    expect(prompt).not.toContain('Davidson');
  });

  it('includes Phase-2 sections when includePhase2 is true', () => {
    const prompt = buildSystemPrompt(true);
    expect(prompt).toContain('keyTermScrutiny');
    expect(prompt).toContain('referentChecks');
    expect(prompt).toContain('falsifiabilityChecks');
    expect(prompt).toContain('Wittgenstein');
    expect(prompt).toContain('Russell');
    expect(prompt).toContain('Davidson');
  });

  it('includes all three issue-type enums in Phase-2 prompt', () => {
    const prompt = buildSystemPrompt(true);
    expect(prompt).toContain('stipulative-smuggling');
    expect(prompt).toContain('cross-language-game-equivocation');
    expect(prompt).toContain('family-resemblance-overreach');
    expect(prompt).toContain('empty-referent');
    expect(prompt).toContain('vague-proper-name');
    expect(prompt).toContain('failed-presupposition');
    expect(prompt).toContain('no-truth-conditions');
    expect(prompt).toContain('circular-truth-conditions');
    expect(prompt).toContain('unfalsifiable-dressed-as-substantive');
  });

  it('always includes base fallacy and loaded-language guidance', () => {
    for (const flag of [false, true]) {
      const prompt = buildSystemPrompt(flag);
      expect(prompt).toContain('Ad Hominem');
      expect(prompt).toContain('Weasel words');
      expect(prompt).toContain('centralClaim');
    }
  });
});

// ---------------------------------------------------------------------------
// Handler — includePhase2 dispatch based on session
// ---------------------------------------------------------------------------

const MINIMAL_AUDIT_JSON = JSON.stringify({
  centralClaim:   'Test.',
  toulmin: {
    claim:            'Test.',
    grounds:          'Test.',
    statedWarrant:    null,
    unstatedWarrants: [],
    weakestLink:      'Test.',
  },
  namedFallacies:       [],
  loadedLanguage:       [],
  notes:                null,
  keyTermScrutiny:      [],
  referentChecks:       [],
  falsifiabilityChecks: [],
});

describe('handleAuditRequest — Phase-2 runs for every caller', () => {
  function makeCapturingProvider(): LlmProvider & { readonly lastSystemInstruction: string } {
    let captured = '';
    return {
      name: 'mock',
      complete: async (req: ProxyRequest) => {
        captured = req.systemInstruction;
        return { content: MINIMAL_AUDIT_JSON, inputTokens: 10, outputTokens: 5 };
      },
      get lastSystemInstruction() { return captured; },
    };
  }

  function makeDeps(provider: LlmProvider, getSession?: AuditHandlerDeps['getSession']): AuditHandlerDeps {
    return {
      rateLimitKv:   undefined,
      geminiApiKey:  'test-key',
      provider,
      extractor:     async () => ({ ok: false, error: { code: 'FETCH_FAILED', message: 'N/A' } }),
      getSession,
    };
  }

  function makeRequest(text: string): Request {
    return new Request('https://test.example/api/audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
  }

  const TEXT = 'a'.repeat(60);

  // Phase 2 used to be a signed-in privilege. The tool is open now, so the
  // full lens suite must reach an anonymous caller identically.
  it('sends the Phase-2 prompt when the user is signed in', async () => {
    const provider = makeCapturingProvider();
    const deps = makeDeps(provider, async () => ({ userId: 'u-1' }));
    await handleAuditRequest(makeRequest(TEXT), deps);
    expect(provider.lastSystemInstruction).toContain('keyTermScrutiny');
    expect(provider.lastSystemInstruction).toContain('Wittgenstein');
  });

  it('sends the Phase-2 prompt to an anonymous caller too', async () => {
    const provider = makeCapturingProvider();
    const deps = makeDeps(provider, async () => null);
    await handleAuditRequest(makeRequest(TEXT), deps);
    expect(provider.lastSystemInstruction).toContain('keyTermScrutiny');
    expect(provider.lastSystemInstruction).toContain('Wittgenstein');
  });

  it('sends the Phase-2 prompt when no getSession is wired at all', async () => {
    const provider = makeCapturingProvider();
    const deps = makeDeps(provider, undefined);
    await handleAuditRequest(makeRequest(TEXT), deps);
    expect(provider.lastSystemInstruction).toContain('keyTermScrutiny');
  });

  // The Studio runs against this endpoint for signed-out writers, so the draft
  // goals the goal selector sets have to reach the prompt here too — the
  // version-scoped route has always supported them.
  it('carries declared draft goals into the prompt', async () => {
    const provider = makeCapturingProvider();
    const req = new Request('https://test.example/api/audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: TEXT, audience: 'academic', intent: 'persuade' }),
    });
    await handleAuditRequest(req, makeDeps(provider));

    expect(provider.lastSystemInstruction).toContain('Draft context');
    expect(provider.lastSystemInstruction).toContain('**Audience:** academic');
    expect(provider.lastSystemInstruction).toContain('**Intent:** persuade');
  });

  it('ignores a half-specified goal pair rather than tuning on it', async () => {
    const provider = makeCapturingProvider();
    const req = new Request('https://test.example/api/audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: TEXT, audience: 'legal' }),  // no intent
    });
    await handleAuditRequest(req, makeDeps(provider));

    expect(provider.lastSystemInstruction).not.toContain('Draft context');
  });

  it('rejects an audience outside the declared set', async () => {
    const provider = makeCapturingProvider();
    const req = new Request('https://test.example/api/audit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: TEXT, audience: 'martian', intent: 'persuade' }),
    });
    const res = await handleAuditRequest(req, makeDeps(provider));
    expect(res.status).toBe(400);
  });

  it('gives signed-in and anonymous callers byte-identical instructions', async () => {
    const signedProvider = makeCapturingProvider();
    await handleAuditRequest(makeRequest(TEXT), makeDeps(signedProvider, async () => ({ userId: 'u-1' })));

    const anonProvider = makeCapturingProvider();
    await handleAuditRequest(makeRequest(TEXT), makeDeps(anonProvider, async () => null));

    expect(anonProvider.lastSystemInstruction).toBe(signedProvider.lastSystemInstruction);
  });
});
