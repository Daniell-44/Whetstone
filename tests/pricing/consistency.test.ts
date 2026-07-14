import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { soloPrice, teamPrice, STUDIO_SOLO } from '../../src/lib/pricing';

// Guards the "$22 in the upsell vs A$33 at checkout" class of bug: a stray
// price literal anywhere in src/ (outside the pricing module) is a drift
// waiting to happen. The canonical strings live in src/lib/pricing.ts.

const SRC = join(__dirname, '..', '..', 'src');
const PRICING_MODULE = join('lib', 'pricing.ts');
// A bare monthly price like "$22/mo" or "A$40/mo" outside the pricing module.
const PRICE_RE = /A?\$\d+\s*\/mo\b/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|astro)$/.test(name)) out.push(p);
  }
  return out;
}

describe('pricing consistency', () => {
  it('canonical strings are the decided values', () => {
    expect(soloPrice).toBe('A$33/mo');
    expect(teamPrice).toBe('A$95/mo');
    expect(STUDIO_SOLO.currency).toBe('AUD');
  });

  it('no stray "$N/mo" price literal lives outside src/lib/pricing.ts', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (file.endsWith(PRICING_MODULE)) continue;
      const text = readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        if (PRICE_RE.test(line)) offenders.push(`${file.replace(SRC, 'src')}: ${line.trim()}`);
      }
    }
    expect(offenders, `price literals found (use src/lib/pricing.ts):\n${offenders.join('\n')}`).toEqual([]);
  });
});
