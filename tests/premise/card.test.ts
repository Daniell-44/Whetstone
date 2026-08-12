import { describe, it, expect } from 'vitest';
import { PremiseCardSchema, buildPremiseCard } from '../../functions/_lib/premise/card';
import type { LlmProvider, ProxyRequest, ProxyResponse } from '../../functions/_lib/providers/types';

/** A provider that returns whatever JSON the test hands it. */
function fake(payload: unknown): LlmProvider {
  return {
    name: 'fake',
    async complete(_req: ProxyRequest, _key: string): Promise<ProxyResponse> {
      return { content: typeof payload === 'string' ? payload : JSON.stringify(payload), inputTokens: 0, outputTokens: 0 };
    },
  };
}
const deps = (p: unknown) => ({ provider: fake(p), apiKey: 'x', model: 'm' });

const CONTESTED = {
  premise: 'Nuclear reactors in Australia would run about 90 per cent of the time.',
  kind: 'predictive',
  status: 'contested',
  statusLine: 'Two named institutions publish incompatible figures for the same quantity.',
  sides: [
    { position: 'Frontier assumes a 90 per cent capacity factor.', who: 'Frontier Economics', quote: 'reactors run 90 per cent of the time' },
    { position: 'GenCost prices 53 to 89 per cent, from coal’s record.', who: 'CSIRO GenCost', quote: '53 to 89 per cent' },
  ],
  whatWouldSettleIt: 'Operating data from an Australian reactor, which does not exist.',
  caveats: [],
};

describe('PremiseCardSchema', () => {
  it('accepts a contested card with named sides', () => {
    expect(PremiseCardSchema.safeParse(CONTESTED).success).toBe(true);
  });

  it('defaults sides and caveats so a settled card needs neither', () => {
    const parsed = PremiseCardSchema.parse({
      premise: 'Human activity is the dominant cause of warming since 1950.',
      kind: 'empirical',
      status: 'settled',
      statusLine: 'The weight of published expert opinion is on one side.',
      consensus: { holds: 'Human influence has warmed the climate.', who: 'IPCC' },
      whatWouldSettleIt: 'Evidence separating anthropogenic from natural forcings differently.',
    });
    expect(parsed.sides).toEqual([]);
    expect(parsed.caveats).toEqual([]);
  });

  it('rejects an unnamed side', () => {
    const bad = { ...CONTESTED, sides: [{ position: 'Some experts disagree.', who: '', quote: 'x' }] };
    expect(PremiseCardSchema.safeParse(bad).success).toBe(false);
  });
});

describe('buildPremiseCard', () => {
  it('flags a settled card that also carries sides, because it would read as false balance', async () => {
    // This is the failure the whole design exists to prevent: a claim that is
    // not in dispute, rendered as a two-sided controversy. The status field
    // says settled but a populated sides array is what a reader actually sees,
    // so the shape is checked rather than trusted to the prompt.
    const { card, error } = await buildPremiseCard('x', deps({
      ...CONTESTED,
      status: 'settled',
      consensus: undefined,
    }));
    expect(card).not.toBeNull();
    expect(error).toMatch(/false balance/);
  });

  it('passes a settled card that carries a consensus block and no sides', async () => {
    const { card, error } = await buildPremiseCard('x', deps({
      premise: 'Human activity is the dominant cause of warming since 1950.',
      kind: 'empirical',
      status: 'settled',
      statusLine: 'The weight of published expert opinion is on one side.',
      sides: [],
      consensus: { holds: 'Human influence has warmed the climate.', who: 'IPCC', dissent: 'NIPCC argues natural cycles dominate.' },
      whatWouldSettleIt: 'Evidence separating the forcings differently.',
      caveats: [],
    }));
    expect(error).toBeUndefined();
    expect(card?.status).toBe('settled');
    expect(card?.consensus?.dissent).toContain('NIPCC');
  });

  it('reports non-JSON rather than throwing', async () => {
    const { card, error } = await buildPremiseCard('x', deps('I cannot help with that.'));
    expect(card).toBeNull();
    expect(error).toBe('model did not return JSON');
  });

  it('reports a schema mismatch with the offending path', async () => {
    const { card, error } = await buildPremiseCard('x', deps({ premise: 'too short elsewhere', kind: 'nonsense', status: 'contested' }));
    expect(card).toBeNull();
    expect(error).toMatch(/kind/);
  });

  it('strips a fenced code block before parsing', async () => {
    const { card } = await buildPremiseCard('x', deps('```json\n' + JSON.stringify(CONTESTED) + '\n```'));
    expect(card?.status).toBe('contested');
  });
});
