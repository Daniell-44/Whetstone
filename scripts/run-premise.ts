/**
 * Draft a premise card and print it.
 *
 *   pnpm tsx scripts/run-premise.ts "Reactors run 90 per cent of the time."
 *   pnpm tsx scripts/run-premise.ts --set    # the three-claim proving set
 *
 * The proving set exists because the whole design rests on one behaviour: when
 * a claim is not actually in dispute, does this say so, or does it manufacture
 * two sides? A tool that always finds a controversy is worse than nothing on a
 * settled claim. So the set deliberately mixes a genuinely contested claim, a
 * settled one, and one that cannot be settled by evidence at all.
 *
 * Quotes come back UNVERIFIED and are printed as such. They are worthless until
 * fetched and matched character-exact against the source.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GeminiProvider } from '../functions/_lib/providers/gemini';
import { buildPremiseCard, type PremiseCard } from '../functions/_lib/premise/card';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadDevVars(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]; })
        .filter(([k]) => k.length > 0),
    );
  } catch { return {}; }
}

const apiKey = process.env.GEMINI_API_KEY ?? loadDevVars(join(ROOT, '.dev.vars')).GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is not set (.dev.vars or environment).');
  process.exit(1);
}

const MODEL = process.env.PREMISE_MODEL ?? 'gemini-2.5-flash';

const PROVING_SET = [
  // Contested: two named institutions publish incompatible figures. From the
  // nuclear briefing, where it is the premise Frontier never states.
  'Nuclear reactors in Australia would run about 90 per cent of the time.',
  // Should come back SETTLED. If this returns "contested" with two sides, the
  // whole approach is unsafe and should not ship.
  'Human activity is the dominant cause of observed global warming since 1950.',
  // Cannot be settled by evidence. Should come back UNSETTLED or NORMATIVE,
  // and the interesting output is that saying so is the finding.
  'Cost should be the deciding factor in choosing a national energy pathway.',
];

function render(c: PremiseCard): string {
  const L: string[] = [];
  L.push('');
  L.push('  ' + c.premise);
  L.push('  ' + '-'.repeat(Math.min(72, c.premise.length)));
  L.push(`  STATUS: ${c.status.toUpperCase()}   KIND: ${c.kind}`);
  L.push('  ' + c.statusLine);
  if (c.consensus) {
    L.push('');
    L.push('  CONSENSUS');
    L.push('    holds:   ' + c.consensus.holds);
    L.push('    who:     ' + c.consensus.who);
    if (c.consensus.dissent) L.push('    dissent: ' + c.consensus.dissent);
  }
  if (c.sides.length) {
    L.push('');
    L.push('  SIDES');
    c.sides.forEach((s, i) => {
      L.push(`    ${i + 1}. ${s.who}${s.publication ? ' · ' + s.publication : ''}${s.date ? ' · ' + s.date : ''}`);
      L.push(`       ${s.position}`);
      L.push(`       "${s.quote}"   [UNVERIFIED]`);
      if (s.url) L.push(`       ${s.url}`);
    });
  }
  L.push('');
  L.push('  WOULD SETTLE IT: ' + c.whatWouldSettleIt);
  if (c.caveats.length) {
    L.push('  CAVEATS:');
    c.caveats.forEach((x) => L.push('    - ' + x));
  }
  return L.join('\n');
}

const args = process.argv.slice(2);
const claims = args[0] === '--set' || args.length === 0 ? PROVING_SET : [args.join(' ')];
const provider = new GeminiProvider();

for (const claim of claims) {
  const t0 = Date.now();
  const { card, error } = await buildPremiseCard(claim, { provider, apiKey, model: MODEL }, undefined);
  const ms = Date.now() - t0;
  if (!card) {
    console.error(`\n  FAILED (${ms}ms): ${claim}\n  ${error}`);
    continue;
  }
  console.log(render(card));
  if (error) console.log('  SHAPE WARNING: ' + error);
  console.log(`  (${ms}ms, ${MODEL})`);
  console.log('\n' + '='.repeat(78));
}
