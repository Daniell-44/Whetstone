import { describe, it, expect } from 'vitest';

import { slugify, generateScorecard } from '../../functions/_lib/scorecard/engine';
import {
  DebateInputSchema,
  Stage1OutputSchema,
  Stage2OutputSchema,
  type DebateInput,
} from '../../functions/_lib/scorecard/schemas';
import {
  buildPositionSynthesisPrompt,
  buildMetaAnalysisPrompt,
} from '../../functions/_lib/scorecard/prompts';
import type { LlmProvider, ProxyRequest, ProxyResponse } from '../../functions/_lib/providers/types';

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Should schools ban smartphones?')).toBe('should-schools-ban-smartphones');
  });

  it('removes non-alphanumeric characters and collapses resulting hyphens', () => {
    // '& ' is removed → double space → '--' → collapses to '-'
    expect(slugify('AI & Creativity: Who Wins?')).toBe('ai-creativity-who-wins');
  });

  it('collapses consecutive hyphens', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it('handles already-slugified input', () => {
    expect(slugify('already-clean')).toBe('already-clean');
  });
});

// ---------------------------------------------------------------------------
// DebateInput validation
// ---------------------------------------------------------------------------

const VALID_INPUT: DebateInput = {
  question: 'Should schools ban smartphones?',
  positions: [
    {
      label: 'Yes — full ban',
      articles: [
        {
          title:       'The evidence for bans',
          publication: 'Education Quarterly',
          url:         'https://example.com/1',
          text:        'Bans improve outcomes according to several studies.',
        },
      ],
    },
    {
      label: 'No — teach responsible use',
      articles: [
        {
          title:       'Digital literacy matters',
          publication: 'EdTech Review',
          url:         'https://example.com/2',
          text:        'Teaching self-regulation produces better long-term results.',
        },
      ],
    },
  ],
};

describe('DebateInputSchema', () => {
  it('accepts a valid input', () => {
    const result = DebateInputSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it('rejects fewer than 2 positions', () => {
    const bad = { ...VALID_INPUT, positions: [VALID_INPUT.positions[0]] };
    expect(DebateInputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects more than 5 positions', () => {
    const pos = VALID_INPUT.positions[0];
    const bad = { ...VALID_INPUT, positions: [pos, pos, pos, pos, pos, pos] };
    expect(DebateInputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects empty article text', () => {
    const bad = {
      ...VALID_INPUT,
      positions: [
        {
          label:    'Yes',
          articles: [{ title: 'T', publication: 'P', url: 'https://x.com', text: '' }],
        },
        VALID_INPUT.positions[1],
      ],
    };
    expect(DebateInputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a position with no articles', () => {
    const bad = {
      ...VALID_INPUT,
      positions: [
        { label: 'Yes', articles: [] },
        VALID_INPUT.positions[1],
      ],
    };
    expect(DebateInputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a position with more than 5 articles', () => {
    const art = VALID_INPUT.positions[0].articles[0];
    const bad = {
      ...VALID_INPUT,
      positions: [
        { label: 'Yes', articles: [art, art, art, art, art, art] },
        VALID_INPUT.positions[1],
      ],
    };
    expect(DebateInputSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Stage output schemas
// ---------------------------------------------------------------------------

describe('Stage1OutputSchema', () => {
  it('accepts valid Stage 1 JSON', () => {
    const valid = {
      bestCase: {
        claim:   'Bans improve attainment.',
        grounds: 'UNESCO found 6.4pp improvement.',
        warrant: 'Attainment correlates with phone-free environments.',
      },
      fatalFlaw: {
        name:        'Selection Bias',
        explanation: 'Studies draw from high-compliance cultures only.',
      },
    };
    expect(Stage1OutputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing fatalFlaw', () => {
    const bad = {
      bestCase: { claim: 'c', grounds: 'g', warrant: 'w' },
    };
    expect(Stage1OutputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects empty strings in bestCase', () => {
    const bad = {
      bestCase: { claim: '', grounds: 'g', warrant: 'w' },
      fatalFlaw: { name: 'n', explanation: 'e' },
    };
    expect(Stage1OutputSchema.safeParse(bad).success).toBe(false);
  });
});

describe('Stage2OutputSchema', () => {
  it('accepts valid Stage 2 JSON', () => {
    const valid = {
      dek:             'An audit of three positions on school smartphone policy.',
      bridgingWarrant: 'All positions treat the smartphone as the primary variable.',
      explanation:     'None of the positions questions whether the underlying pedagogy creates the problem.',
    };
    expect(Stage2OutputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing bridgingWarrant', () => {
    const bad = {
      dek:         'A scorecard.',
      explanation: 'Some explanation.',
    };
    expect(Stage2OutputSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects malformed JSON string', () => {
    const isBrokenJson = (): boolean => {
      try {
        JSON.parse('{ "dek": "missing closing brace"');
        return false;
      } catch {
        return true;
      }
    };
    expect(isBrokenJson()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

describe('buildPositionSynthesisPrompt', () => {
  it('includes the position label', () => {
    const prompt = buildPositionSynthesisPrompt(VALID_INPUT.positions[0]);
    expect(prompt).toContain('Yes — full ban');
  });

  it('includes the article title and publication', () => {
    const prompt = buildPositionSynthesisPrompt(VALID_INPUT.positions[0]);
    expect(prompt).toContain('The evidence for bans');
    expect(prompt).toContain('Education Quarterly');
  });

  it('includes the article text', () => {
    const prompt = buildPositionSynthesisPrompt(VALID_INPUT.positions[0]);
    expect(prompt).toContain('Bans improve outcomes according to several studies.');
  });

  it('includes all articles when there are multiple', () => {
    const posWithTwo = {
      ...VALID_INPUT.positions[0],
      articles: [
        ...VALID_INPUT.positions[0].articles,
        {
          title:       'A second article',
          publication: 'Journal B',
          url:         'https://example.com/3',
          text:        'Second article text here.',
        },
      ],
    };
    const prompt = buildPositionSynthesisPrompt(posWithTwo);
    expect(prompt).toContain('A second article');
    expect(prompt).toContain('Second article text here.');
  });
});

describe('buildMetaAnalysisPrompt', () => {
  const syntheses = [
    {
      label:     'Yes — full ban',
      synthesis: {
        bestCase:  { claim: 'Bans work.', grounds: 'Studies show improvement.', warrant: 'Attention matters.' },
        fatalFlaw: { name: 'Selection Bias', explanation: 'Limited to compliant cultures.' },
      },
    },
    {
      label:     'No — teach use',
      synthesis: {
        bestCase:  { claim: 'Skills matter.', grounds: 'Post-grad data shows better outcomes.', warrant: 'Self-regulation transfers.' },
        fatalFlaw: { name: 'Temporal Displacement', explanation: 'Defers short-term harm to future benefit.' },
      },
    },
  ];

  it('includes the debate question', () => {
    const prompt = buildMetaAnalysisPrompt('Should schools ban smartphones?', syntheses);
    expect(prompt).toContain('Should schools ban smartphones?');
  });

  it('includes all position labels', () => {
    const prompt = buildMetaAnalysisPrompt('Should schools ban smartphones?', syntheses);
    expect(prompt).toContain('Yes — full ban');
    expect(prompt).toContain('No — teach use');
  });

  it('includes flaw names and explanations', () => {
    const prompt = buildMetaAnalysisPrompt('Should schools ban smartphones?', syntheses);
    expect(prompt).toContain('Selection Bias');
    expect(prompt).toContain('Temporal Displacement');
  });
});

// ---------------------------------------------------------------------------
// generateScorecard — end-to-end with fake provider
// ---------------------------------------------------------------------------

const STAGE1_RESPONSE_TEMPLATE = (n: number): string =>
  JSON.stringify({
    bestCase: {
      claim:   `Position ${n} makes a strong claim.`,
      grounds: `Grounds for position ${n} from the supplied articles.`,
      warrant: `Warrant for position ${n}: the unstated assumption.`,
    },
    fatalFlaw: {
      name:        `Flaw ${n} Name`,
      explanation: `This is the structural weakness of position ${n}.`,
    },
  });

const STAGE2_RESPONSE = JSON.stringify({
  dek:             'An audit of competing positions on the debate question.',
  bridgingWarrant: 'All positions share an unstated assumption about measurement.',
  explanation:     'None of the positions questions whether the thing being measured is the right measure. If it were questioned, the debate would reframe entirely.',
});

class FakeProvider implements LlmProvider {
  readonly name = 'fake';
  private callIndex = 0;
  readonly callLog: ProxyRequest[] = [];

  constructor(private readonly responses: string[]) {}

  async complete(req: ProxyRequest, _apiKey: string): Promise<ProxyResponse> {
    const idx = this.callIndex++;
    this.callLog.push(req);
    const content = this.responses[idx];
    if (content === undefined) {
      throw new Error(`FakeProvider: unexpected call #${idx} (operation: ${req.operation})`);
    }
    return { content, inputTokens: 100, outputTokens: 50 };
  }
}

describe('generateScorecard', () => {
  it('produces a Scorecard with correct structure from two positions', async () => {
    const provider = new FakeProvider([
      STAGE1_RESPONSE_TEMPLATE(0), // position 0
      STAGE1_RESPONSE_TEMPLATE(1), // position 1
      STAGE2_RESPONSE,             // meta-analysis
    ]);

    const { scorecard } = await generateScorecard(VALID_INPUT, {
      provider,
      apiKey: 'fake-key',
    });

    expect(scorecard.slug).toBe('should-schools-ban-smartphones');
    expect(scorecard.question).toBe(VALID_INPUT.question);
    expect(scorecard.positions).toHaveLength(2);
    expect(scorecard.positions[0].label).toBe('Yes — full ban');
    expect(scorecard.positions[0].bestCase.claim).toBe('Position 0 makes a strong claim.');
    expect(scorecard.positions[0].fatalFlaw.name).toBe('Flaw 0 Name');
    // Sources must come from input, not LLM.
    expect(scorecard.positions[0].sources[0].title).toBe('The evidence for bans');
    expect(scorecard.positions[0].sources[0].url).toBe('https://example.com/1');
    expect(scorecard.metaAnalysis.bridgingWarrant).toBe(
      'All positions share an unstated assumption about measurement.',
    );
    expect(scorecard.publishedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sums token usage across all calls', async () => {
    const provider = new FakeProvider([
      STAGE1_RESPONSE_TEMPLATE(0),
      STAGE1_RESPONSE_TEMPLATE(1),
      STAGE2_RESPONSE,
    ]);

    const { usage } = await generateScorecard(VALID_INPUT, { provider, apiKey: 'k' });

    // 3 calls × 100 input + 3 calls × 50 output
    expect(usage.inputTokens).toBe(300);
    expect(usage.outputTokens).toBe(150);
  });

  it('uses operation:analyze for Stage 1 and synthesize for Stage 2', async () => {
    const provider = new FakeProvider([
      STAGE1_RESPONSE_TEMPLATE(0),
      STAGE1_RESPONSE_TEMPLATE(1),
      STAGE2_RESPONSE,
    ]);

    await generateScorecard(VALID_INPUT, { provider, apiKey: 'k' });

    expect(provider.callLog[0].operation).toBe('analyze');
    expect(provider.callLog[1].operation).toBe('analyze');
    expect(provider.callLog[2].operation).toBe('synthesize');
  });

  it('retries Stage 1 once on bad JSON, then succeeds', async () => {
    // Promise.all starts both positions concurrently. The interleaved call order
    // with a synchronous fake is: [pos0-attempt1, pos1-attempt1, pos0-attempt2, stage2].
    const provider = new FakeProvider([
      'not valid json',              // pos0, attempt 1 → fails
      STAGE1_RESPONSE_TEMPLATE(1),   // pos1, attempt 1 → succeeds
      STAGE1_RESPONSE_TEMPLATE(0),   // pos0, attempt 2 → succeeds
      STAGE2_RESPONSE,
    ]);

    const { scorecard } = await generateScorecard(VALID_INPUT, { provider, apiKey: 'k' });
    // Engine should complete successfully after the retry; both positions present.
    expect(scorecard.positions).toHaveLength(2);
    expect(scorecard.metaAnalysis.bridgingWarrant).toBeTruthy();
  });

  it('throws after two consecutive validation failures for any position', async () => {
    // Provide 4 bad responses — enough for both positions to exhaust both attempts
    // under Promise.all's interleaved call order.
    const provider = new FakeProvider([
      'bad json', // pos0, attempt 1
      'bad json', // pos1, attempt 1
      'bad json', // pos0, attempt 2 → throws
      'bad json', // pos1, attempt 2 → throws
    ]);

    await expect(
      generateScorecard(VALID_INPUT, { provider, apiKey: 'k' }),
    ).rejects.toThrow(/failed validation after 2 attempts/);
  });

  it('rejects invalid DebateInput before making any LLM calls', async () => {
    const provider = new FakeProvider([]);
    const bad = { question: '', positions: [] };

    await expect(
      generateScorecard(bad as unknown as DebateInput, { provider, apiKey: 'k' }),
    ).rejects.toThrow(/Invalid DebateInput/);

    expect(provider.callLog).toHaveLength(0);
  });
});
