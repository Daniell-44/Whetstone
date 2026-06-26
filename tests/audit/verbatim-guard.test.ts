import { describe, it, expect } from 'vitest';
import { filterValidQuotes } from '../../functions/_lib/audit/engine';
import type { AuditResult, NamedFallacy } from '../../functions/_lib/audit/types';
import { structural } from '../../functions/_lib/grounded/types';

function auditWithQuote(quote: string): AuditResult {
  const f: NamedFallacy = {
    name: 'Ad Hominem', quote, explanation: 'x', severity: 'low', groundedness: structural(),
  };
  return {
    centralClaim: 'c',
    toulmin: { claim: 'c', grounds: 'g', statedWarrant: null, unstatedWarrants: [], weakestLink: 'w' },
    namedFallacies: [f],
    loadedLanguage: [], notes: null,
    keyTermScrutiny: [], referentChecks: [], falsifiabilityChecks: [], modalScopeChecks: [],
  };
}

describe('filterValidQuotes — verbatim modulo typography', () => {
  it('keeps a quote that differs only by a smart vs straight apostrophe', () => {
    const source = 'The argument fails because it’s clearly circular.'; // curly ’
    const { audit, dropped } = filterValidQuotes(auditWithQuote("it's clearly circular"), source); // straight '
    expect(audit.namedFallacies).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it('keeps a quote that spans a line break (whitespace normalised)', () => {
    const source = 'Ever since the cycle\nlanes went in, sales fell.';
    const { audit } = filterValidQuotes(auditWithQuote('the cycle lanes'), source);
    expect(audit.namedFallacies).toHaveLength(1);
  });

  it('still drops a genuinely reworded (paraphrased) quote', () => {
    const source = 'The argument fails because it is clearly circular.';
    const { audit, dropped } = filterValidQuotes(auditWithQuote('the reasoning is obviously circular'), source);
    expect(audit.namedFallacies).toHaveLength(0);
    expect(dropped).toContain('namedFallacies[Ad Hominem]');
  });
});
