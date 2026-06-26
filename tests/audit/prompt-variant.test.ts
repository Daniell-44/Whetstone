import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../functions/_lib/audit/prompts';

const MARKER = 'regardless of who wrote it';

describe('buildSystemPrompt impartiality variant', () => {
  it('control (default) omits the impartiality clause — production is unchanged', () => {
    expect(buildSystemPrompt(false)).not.toContain(MARKER);
    expect(buildSystemPrompt(true)).not.toContain(MARKER);
  });

  it('impartial variant injects the negative-prompting clause', () => {
    expect(buildSystemPrompt(false, undefined, { impartiality: true })).toContain(MARKER);
  });

  it('the variant changes nothing else — the fallacy list is still present in both', () => {
    const control = buildSystemPrompt(false);
    const impartial = buildSystemPrompt(false, undefined, { impartiality: true });
    expect(control).toContain('Ad Hominem');
    expect(impartial).toContain('Ad Hominem');
    // impartial is exactly control + the clause (same length delta)
    expect(impartial.length).toBeGreaterThan(control.length);
  });
});

describe('buildSystemPrompt reasoningFirst variant', () => {
  it('control (default) omits the _reasoning field — production is unchanged', () => {
    expect(buildSystemPrompt(false)).not.toContain('"_reasoning"');
  });

  it('reasoningFirst injects a _reasoning field before centralClaim', () => {
    const p = buildSystemPrompt(false, undefined, { reasoningFirst: true });
    expect(p).toContain('"_reasoning"');
    expect(p.indexOf('"_reasoning"')).toBeLessThan(p.indexOf('"centralClaim"'));
  });

  it('flags compose independently', () => {
    const both = buildSystemPrompt(false, undefined, { impartiality: true, reasoningFirst: true });
    expect(both).toContain(MARKER);
    expect(both).toContain('"_reasoning"');
  });
});
