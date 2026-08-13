/**
 * Build a mini-briefing from an article, and report what it cost.
 *
 *   pnpm tsx scripts/run-mini.ts path/to/article.txt
 *   pnpm tsx scripts/run-mini.ts            # uses the built-in sample
 *
 * Consumes the STREAM rather than the finished object, and stamps every event
 * with the seconds elapsed. That is the measurement that matters for the staged
 * reveal: not how long the whole thing takes, but how long the reader waits
 * before there is anything on screen.
 *
 * Also prints what was dropped and why, because the drops are the product.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GeminiProvider } from '../functions/_lib/providers/gemini';
import { streamMiniBriefing, type MiniBriefing, type MiniSource } from '../functions/_lib/premise/mini';

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

const t0 = Date.now();
const at = () => `[${((Date.now() - t0) / 1000).toFixed(1)}s]`.padStart(8);

function printSource(s: MiniSource, indent: string) {
  const stance = (s.stance ?? 'unstated').toUpperCase();
  console.log(`\n${indent}${stance} · ${s.who}${s.publication ? ' · ' + s.publication : ''}`);
  console.log(`${indent}${s.position}`);
  if (s.addresses) console.log(`${indent}on: ${s.addresses}`);
  console.log(`${indent}"${s.quote}"`);
  console.log(`${indent}${s.resolvedUrl ?? s.url}`);
}

let final: MiniBriefing | null = null;

for await (const ev of streamMiniBriefing(text, { provider: new GeminiProvider(), apiKey, maxPremises: 2 })) {
  if (ev.type === 'outline') {
    console.log('\n' + '='.repeat(78));
    console.log(`${at()} OUTLINE  <- the reader can start here`);
    console.log('='.repeat(78));
    console.log(`\n  QUESTION:   ${ev.outline.question || '(not identified)'}`);
    console.log(`  CONCLUDES:  ${ev.outline.conclusion || '(not identified)'}`);
    console.log('\n  RESTS ON:');
    ev.outline.claims.forEach((c, i) => {
      console.log(`    ${i + 1}. ${c.claim}`);
      console.log(`       if false: ${c.load}`);
    });
  } else if (ev.type === 'researching') {
    console.log(`\n${at()} searching ${ev.claims.length} claim(s) in parallel...`);
  } else if (ev.type === 'premise') {
    console.log(`\n${at()} PREMISE ${ev.index + 1}: ${ev.premise.claim}`);
    if (ev.premise.undisputed) console.log('         (nothing found that disputes it)');
    ev.premise.sources.forEach((s) => printSource(s, '         '));
  } else if (ev.type === 'premise-empty') {
    console.log(`\n${at()} PREMISE ${ev.index + 1}: nothing shown. ${ev.why}`);
    console.log(`         ${ev.claim}`);
  } else if (ev.type === 'done') {
    final = ev.briefing;
  }
}

if (!final) { console.error('no result'); process.exit(1); }

console.log(`\n${at()} DONE · TIER ${final.tier.toUpperCase()}`);

for (const s of final.opposing) printSource(s, '         ');

if (final.limits.length) {
  console.log('\n  LIMITS');
  final.limits.forEach((l) => console.log('    - ' + l));
}

console.log('\n  DROPPED');
console.log(`    failed the quote check (not real):     ${final.dropped.unverified}`);
console.log(`    failed the relevance check (not about the claim): ${final.dropped.offClaim}`);

// Gemini 2.5 Flash list prices, checked 13 August 2026. Grounded search
// requests bill separately from tokens, which is the cost most people miss.
const IN_PER_M = 0.30, OUT_PER_M = 2.50, GROUNDING_PER_1K = 35;
const tokenCost = (final.cost.inputTokens / 1e6) * IN_PER_M + (final.cost.outputTokens / 1e6) * OUT_PER_M;
const groundCost = (final.cost.groundedCalls / 1000) * GROUNDING_PER_1K;

console.log('\n  TIMING');
console.log(`    outline on screen at: ${(final.timing.outlineMs / 1000).toFixed(1)}s   <- what the reader waits`);
console.log(`    everything finished:  ${(final.timing.totalMs / 1000).toFixed(1)}s`);

console.log('\n  COST');
console.log(`    model calls:     ${final.cost.calls} (${final.cost.groundedCalls} with search)`);
console.log(`    tokens:          ${final.cost.inputTokens} in / ${final.cost.outputTokens} out`);
console.log(`    token spend:     $${tokenCost.toFixed(5)}`);
console.log(`    grounding spend: $${groundCost.toFixed(5)}  (${final.cost.groundedCalls} x $${(GROUNDING_PER_1K / 1000).toFixed(3)})`);
console.log(`    TOTAL:           $${(tokenCost + groundCost).toFixed(4)} per mini-briefing`);
console.log(`    per 1,000:       $${((tokenCost + groundCost) * 1000).toFixed(2)}\n`);
