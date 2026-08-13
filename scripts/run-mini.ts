/**
 * Build a mini-briefing from an article, and report what it cost.
 *
 *   pnpm tsx scripts/run-mini.ts path/to/article.txt
 *   pnpm tsx scripts/run-mini.ts            # uses the built-in sample
 *
 * Prints the tier it reached, what survived verification, and the real token
 * and grounded-call counts, because the cost question is the one that decides
 * whether this can run per request.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GeminiProvider } from '../functions/_lib/providers/gemini';
import { buildMiniBriefing } from '../functions/_lib/premise/mini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function devVars(p: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(p, 'utf-8').split('\n').filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]; }),
    );
  } catch { return {}; }
}
const apiKey = process.env.GEMINI_API_KEY ?? devVars(join(ROOT, '.dev.vars')).GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

// A short argued piece in the house's own beat, written for this test so no
// publisher's text is being copied around.
const SAMPLE = `Australia should build nuclear power, and the costings debate has been settled in its favour.
Frontier Economics found that a nuclear-inclusive grid is 25 per cent cheaper than the renewables-only
pathway AEMO has planned for. That figure holds because reactors run about 90 per cent of the time,
far above what wind and solar manage even with storage, and because the build cost is spread across a
fifty year operating life rather than the shorter horizons critics prefer. CSIRO's GenCost report is
often cited against this, but GenCost prices each technology on its own and admits it cannot be used
to compare whole pathways. The choice is between a cheaper grid and an ideological commitment to
renewables, and the numbers now favour the former.`;

const file = process.argv[2];
const text = file ? readFileSync(file, 'utf-8') : SAMPLE;

const mini = await buildMiniBriefing(text, { provider: new GeminiProvider(), apiKey, maxPremises: 2 });

console.log('\n' + '='.repeat(78));
console.log('QUESTION: ' + (mini.question || '(not identified)'));
console.log('TIER:     ' + mini.tier.toUpperCase());
console.log('='.repeat(78));

for (const p of mini.premises) {
  console.log('\n  CLAIM: ' + p.claim);
  console.log('  LOAD:  ' + p.load);
  for (const s of p.sources) {
    console.log(`\n    ${s.who}${s.publication ? ' · ' + s.publication : ''}`);
    console.log(`    ${s.position}`);
    console.log(`    "${s.quote}"`);
    console.log(`    ${s.resolvedUrl ?? s.url}`);
  }
}
for (const s of mini.opposing) {
  console.log(`\n  OPPOSING: ${s.who}${s.publication ? ' · ' + s.publication : ''}`);
  console.log(`    ${s.position}`);
  console.log(`    "${s.quote}"`);
  console.log(`    ${s.resolvedUrl ?? s.url}`);
}

if (mini.limits.length) {
  console.log('\n  LIMITS');
  mini.limits.forEach((l) => console.log('    - ' + l));
}

// Gemini 2.5 Flash list prices, checked 13 August 2026. Grounded search
// requests bill separately from tokens, which is the cost most people miss.
const IN_PER_M = 0.30, OUT_PER_M = 2.50, GROUNDING_PER_1K = 35;
const tokenCost = (mini.cost.inputTokens / 1e6) * IN_PER_M + (mini.cost.outputTokens / 1e6) * OUT_PER_M;
const groundCost = (mini.cost.groundedCalls / 1000) * GROUNDING_PER_1K;

console.log('\n  COST');
console.log(`    wall clock:      ${(mini.cost.ms / 1000).toFixed(1)}s`);
console.log(`    model calls:     ${mini.cost.calls} (${mini.cost.groundedCalls} with search)`);
console.log(`    tokens:          ${mini.cost.inputTokens} in / ${mini.cost.outputTokens} out`);
console.log(`    token spend:     $${tokenCost.toFixed(5)}`);
console.log(`    grounding spend: $${groundCost.toFixed(5)}  (${mini.cost.groundedCalls} x $${(GROUNDING_PER_1K / 1000).toFixed(3)})`);
console.log(`    TOTAL:           $${(tokenCost + groundCost).toFixed(4)} per mini-briefing`);
console.log(`    per 1,000:       $${((tokenCost + groundCost) * 1000).toFixed(2)}\n`);
