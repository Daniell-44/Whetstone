import type { ArgumentMap } from './schema';

/**
 * P0 fixtures — synthetic demonstration data for the render contract.
 *
 * Every article, outlet, and quote here is INVENTED (example.com domains);
 * the only real objects are the Whetstone's own briefing references. These
 * exist so both surfaces (site labs page, extension panel) can render every
 * state of the three surfaces:
 *
 *   briefingHit — tier-1 placement (matched our nuclear briefing), no fatal
 *                 finding: the error tab stays hidden.
 *   fatalDemo   — tier-3 live placement, one fatal finding: the tab shows.
 *   noPlacement — skeleton only: the honest empty states.
 */

export const briefingHit: ArgumentMap = {
  meta: {
    url: 'https://example.com/opinion/nuclear-numbers-work',
    title: 'Sample op-ed: the nuclear numbers work',
    accessedAt: '2026-08-09',
  },
  skeleton: {
    claims: [
      'An Australian nuclear build would deliver cheaper firmed power than the renewables pathway.',
    ],
    premises: [
      {
        id: 'p1',
        tag: 'stated',
        text: 'Large reactors run for sixty years; the official comparison writes them off over thirty.',
      },
      {
        id: 'p2',
        tag: 'quoted',
        crux: true,
        text: 'the CSIRO numbers simply do not survive contact with a sixty-year asset life',
      },
      {
        id: 'p3',
        tag: 'supplied',
        text: "A comparison that halves an asset's life roughly doubles its apparent cost of capital.",
      },
    ],
    links: [
      {
        from: ['p1', 'p3'],
        to: 'C',
        rule: 'cost amortisation',
        note: 'a longer write-off spreads the same capital over more output',
      },
      { from: ['p2'], to: 'C', rule: 'appeal to expert judgement' },
    ],
    warrants: [
      {
        text: 'Plants actually reach sixty years under Australian conditions.',
        necessity: 'The amortisation step needs the lifetime to be real, not nameplate.',
      },
    ],
  },
  placement: {
    question: 'Why nobody actually knows if nuclear is cheaper',
    axisLeft: 'nuclear pathway cheaper',
    axisRight: 'renewables pathway cheaper',
    stance: -2,
    camp: 'Fighting inside the models',
    respondsTo: 'GenCost 2025-26 (CSIRO/AEMO)',
    confidence: 'high',
    basisQuote: 'the CSIRO numbers simply do not survive contact with a sixty-year asset life',
    tier: 'briefing',
    briefingSlug: 'nuclear-costings-parent',
  },
  suggestions: [
    {
      kind: 'briefing',
      title: 'Why nobody actually knows if nuclear is cheaper',
      source: 'The Whetstone',
      url: 'https://thewhetstone.review/briefing/nuclear-costings-parent',
      stance: null,
      whyWorthIt:
        "The full field, audited: seven method choices decide the headline number, and both sides' premises are quoted verbatim.",
    },
    {
      kind: 'opposing',
      title: 'Sample reply: the sixty-year plant is a spreadsheet, not a fleet',
      source: 'Example Review',
      url: 'https://example.com/reply-asset-life',
      stance: 2,
      whyWorthIt:
        "The strongest form of the other side on exactly this piece's crux: what lifetime the evidence actually supports.",
    },
  ],
  findings: [
    {
      name: 'Best-case operating history presented as the base case',
      quote: 'reactors overseas routinely run at full tilt',
      explanation:
        'The piece treats the strongest observed performance as the expected performance; which past predicts an Australian build is a real, unresolved dispute.',
      severity: 'medium',
      groundedness: 'interpretive',
      location: 'aside',
    },
  ],
};

export const fatalDemo: ArgumentMap = {
  meta: {
    url: 'https://example.com/opinion/prices-always-rise',
    title: 'Sample op-ed: housing never loses',
    accessedAt: '2026-08-09',
  },
  skeleton: {
    claims: ['Housing remains the safest investment an ordinary buyer can make.'],
    premises: [
      {
        id: 'p1',
        tag: 'stated',
        crux: true,
        text: 'Australian house prices have risen through most of the last forty years.',
      },
      {
        id: 'p2',
        tag: 'supplied',
        text: 'What has risen for forty years will keep rising.',
      },
    ],
    links: [{ from: ['p1', 'p2'], to: 'C', rule: 'inductive projection' }],
    warrants: [
      {
        text: 'The conditions behind past rises persist.',
        necessity: 'Projecting a trend forward needs its causes to still be in place.',
      },
    ],
  },
  placement: {
    question: 'Is housing a sound investment for ordinary buyers?',
    axisLeft: 'housing is a sound investment',
    axisRight: 'housing is a poor investment',
    stance: -2,
    respondsTo: "A bank's quarterly price-index release",
    confidence: 'low',
    basisQuote: 'Prices have always risen, which is why they will keep rising.',
    tier: 'live',
  },
  suggestions: [
    {
      kind: 'opposing',
      title: 'Sample analysis: the forty-year trends that stopped',
      source: 'Example Economics',
      url: 'https://example.com/trends-that-stopped',
      stance: 2,
      whyWorthIt:
        'The strongest counter on the load-bearing step: trend projection, and the documented cases where the trend ended.',
    },
    {
      kind: 'adjacent',
      title: 'Sample explainer: what a price index does and does not measure',
      source: 'Example Explainers',
      url: 'https://example.com/price-index-explainer',
      stance: null,
      whyWorthIt: 'Neither side of the question; the measurement both sides lean on.',
    },
  ],
  findings: [
    {
      name: 'The conclusion restates its own premise',
      quote: 'Prices have always risen, which is why they will keep rising.',
      explanation:
        'The reason offered for the conclusion IS the conclusion: past rises serve as both the evidence and the thing being proven. Nothing outside the pattern supports the pattern continuing.',
      severity: 'high',
      groundedness: 'structural',
      location: 'conclusion',
    },
    {
      name: 'Emphasis standing in for support',
      quote: 'the safest investment, full stop',
      explanation: 'An intensifier where a reason should be.',
      severity: 'low',
      groundedness: 'interpretive',
      location: 'aside',
    },
  ],
};

export const noPlacement: ArgumentMap = {
  meta: {
    url: 'https://example.com/letters/reopen-the-pool',
    title: 'A short letter to the editor',
    accessedAt: '2026-08-09',
  },
  skeleton: {
    claims: ['The council should reopen the pool on weekends.'],
    premises: [
      { id: 'p1', tag: 'stated', text: 'The pool is closed on weekends.' },
      { id: 'p2', tag: 'stated', text: 'Weekend demand is the highest of the week.' },
    ],
    links: [{ from: ['p1', 'p2'], to: 'C', rule: 'means-end reasoning' }],
    warrants: [],
  },
  placement: null,
  suggestions: [],
  findings: [],
};

export const FIXTURES = { briefingHit, fatalDemo, noPlacement } as const;
export type FixtureName = keyof typeof FIXTURES;
