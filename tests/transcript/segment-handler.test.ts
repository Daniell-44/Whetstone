/**
 * The segment-only transcript route.
 *
 * This exists because the whole-transcript audit is the most expensive thing
 * on the site: one segmentation call, up to twelve per-segment audits, and a
 * gemini-2.5-pro synthesis. This route runs the first of those and stops, so
 * the reader spends a real audit only on the segment they pick.
 *
 * The two rules worth guarding are the ones that would cost money or leak
 * something if they broke: the model is called exactly once, and the model's
 * per-segment confidence number never reaches the browser.
 */
import { describe, it, expect, vi } from 'vitest';
import { handleSegmentRequest, forClient } from '../../functions/_lib/transcript/segment-handler';
import type { SegmentHandlerDeps } from '../../functions/_lib/transcript/segment-handler';
import type { ArgumentSegment, TranscriptInput } from '../../functions/_lib/transcript/types';

function segment(over: Partial<ArgumentSegment> = {}): ArgumentSegment {
  return {
    id:           'seg-1',
    kind:         'argument',
    startSec:     0,
    endSec:       120,
    claimSummary: 'Nuclear is cheaper than firmed renewables at scale.',
    text:         'The claim is that nuclear beats firmed renewables once you count transmission.',
    confidence:   80,
    ...over,
  };
}

/** A provider that returns one segmentation payload and counts its calls. */
function makeProvider(segments: ArgumentSegment[]) {
  const complete = vi.fn(async () => ({
    // The provider contract is { content, inputTokens, outputTokens }.
    content: JSON.stringify({
      segments,
      totalSegments: segments.length + 3,
      argumentCount: segments.length,
      excludedCount: 3,
      notes:         null,
    }),
    inputTokens:  1000,
    outputTokens: 200,
  }));
  return { complete } as never;
}

function makeDeps(over: Partial<SegmentHandlerDeps> = {}): SegmentHandlerDeps {
  return {
    rateLimitKv:  undefined,
    geminiApiKey: 'test-key',
    userDailyCap: 20,
    anonDailyCap: 5,
    provider:     makeProvider([segment()]),
    getSession:   async () => null,
    ...over,
  };
}

function post(body: unknown): Request {
  return new Request('https://example.com/api/transcript-segments', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
}

const LONG_TRANSCRIPT = 'So the argument goes like this. '.repeat(20);

describe('handleSegmentRequest', () => {
  it('segments pasted text with exactly one model call', async () => {
    // The whole point of the route. If this ever calls the provider more than
    // once, the cost saving that justified splitting Stage A is gone.
    const provider = makeProvider([segment()]);
    const res  = await handleSegmentRequest(post({ kind: 'text', text: LONG_TRANSCRIPT }), makeDeps({ provider }));
    const body = await res.json() as { ok: boolean; segments: unknown[] };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.segments).toHaveLength(1);
    expect((provider as unknown as { complete: { mock: { calls: unknown[] } } }).complete.mock.calls).toHaveLength(1);
  });

  it('never ships the per-segment confidence number to the browser', async () => {
    // A number that reaches a page eventually gets rendered as a badge, and
    // this one measures "is this passage an argument", not how good it is.
    const res  = await handleSegmentRequest(post({ kind: 'text', text: LONG_TRANSCRIPT }), makeDeps());
    const raw  = await res.text();

    expect(raw).not.toContain('confidence');
    expect(JSON.parse(raw).segments[0]).not.toHaveProperty('confidence');
  });

  it('keeps only argument segments, and says how many it dropped', async () => {
    // An hour of podcast is mostly not an argument. Showing four rows without
    // saying what was excluded invites the reader to think that was all of it.
    const provider = makeProvider([
      segment({ id: 'a' }),
      segment({ id: 'b', kind: 'sponsor_read' }),
      segment({ id: 'c', kind: 'narrative' }),
    ]);
    const res  = await handleSegmentRequest(post({ kind: 'text', text: LONG_TRANSCRIPT }), makeDeps({ provider }));
    const body = await res.json() as { segments: { id: string }[]; excluded: { count: number; total: number } };

    expect(body.segments.map(s => s.id)).toEqual(['a']);
    expect(body.excluded.total).toBe(6);
    expect(body.excluded.count).toBe(5);
  });

  it('orders segments by the model confidence it does not publish', async () => {
    const provider = makeProvider([
      segment({ id: 'weak',   confidence: 40 }),
      segment({ id: 'strong', confidence: 95 }),
      segment({ id: 'middle', confidence: 70 }),
    ]);
    const res  = await handleSegmentRequest(post({ kind: 'text', text: LONG_TRANSCRIPT }), makeDeps({ provider }));
    const body = await res.json() as { segments: { id: string }[] };

    expect(body.segments.map(s => s.id)).toEqual(['strong', 'middle', 'weak']);
  });

  it('reports a captionless video as its own condition, not a generic failure', async () => {
    // "Paste the transcript instead" is actionable; "something went wrong" is
    // not, and captions-disabled is the most common way this path fails.
    const res  = await handleSegmentRequest(
      post({ kind: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefghijk' }),
      makeDeps({ fetchYouTube: async () => null }),
    );
    const body = await res.json() as { ok: boolean; error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NO_CAPTIONS');
  });

  it('does not call the model when the body is unusable', async () => {
    const provider = makeProvider([segment()]);
    const res = await handleSegmentRequest(post({ kind: 'text', text: 'too short' }), makeDeps({ provider }));

    expect(res.status).toBe(400);
    expect((provider as unknown as { complete: { mock: { calls: unknown[] } } }).complete.mock.calls).toHaveLength(0);
  });

  it('blocks an anonymous caller who is over the daily cap, before spending a call', async () => {
    const provider = makeProvider([segment()]);
    const store = new Map<string, string>();
    const kv = {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => { store.set(k, v); },
    };

    const deps = makeDeps({ provider, rateLimitKv: kv as never, anonDailyCap: 2 });
    for (let i = 0; i < 2; i++) {
      await handleSegmentRequest(post({ kind: 'text', text: LONG_TRANSCRIPT }), deps);
    }
    const res  = await handleSegmentRequest(post({ kind: 'text', text: LONG_TRANSCRIPT }), deps);
    const body = await res.json() as { ok: boolean; error: { code: string } };

    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect((provider as unknown as { complete: { mock: { calls: unknown[] } } }).complete.mock.calls).toHaveLength(2);
  });

  it('passes a fetched YouTube transcript through to segmentation', async () => {
    const input: TranscriptInput = {
      sourceType: 'youtube',
      sourceUrl:  'https://www.youtube.com/watch?v=abcdefghijk',
      title:      'A debate about costings',
      cues:       [{ startSec: 0, endSec: 30, text: LONG_TRANSCRIPT }],
    };
    const res  = await handleSegmentRequest(
      post({ kind: 'youtube', url: input.sourceUrl! }),
      makeDeps({ fetchYouTube: async () => input }),
    );
    const body = await res.json() as { ok: boolean; title: string; sourceUrl: string };

    expect(body.ok).toBe(true);
    expect(body.title).toBe('A debate about costings');
    expect(body.sourceUrl).toBe(input.sourceUrl);
  });
});

describe('forClient', () => {
  it('counts words so the reader knows what an audit will cover', () => {
    const [only] = forClient([segment({ text: 'one two three four five' })]);
    expect(only!.words).toBe(5);
  });

  it('carries the verbatim text through untouched', () => {
    // The picked segment becomes the audit input, so any tidying here would
    // silently change what got audited relative to what was said.
    const text = '  Spacing   and\npunctuation, kept.  ';
    const [only] = forClient([segment({ text })]);
    expect(only!.text).toBe(text);
  });
});
