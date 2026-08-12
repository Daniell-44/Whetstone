/**
 * Retrieve real sources for a premise, then check every quote against the page
 * it came from.
 *
 *   pnpm tsx scripts/run-premise-grounded.ts "Nuclear reactors in Australia would run about 90 per cent of the time."
 *
 * Prints what survived and what was dropped, because the drops are the point.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { retrievePremise, verifySources, type GroundedSource } from '../functions/_lib/premise/grounded';
import { GeminiProvider } from '../functions/_lib/providers/gemini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadDevVars(p: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(p, 'utf-8').split('\n').filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]; }),
    );
  } catch { return {}; }
}
const apiKey = process.env.GEMINI_API_KEY ?? loadDevVars(join(ROOT, '.dev.vars')).GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

const MODEL = 'gemini-2.5-flash';
const premise = process.argv.slice(2).join(' ') || 'Nuclear reactors in Australia would run about 90 per cent of the time.';

console.log('\nCLAIM: ' + premise);
console.log('='.repeat(78));

// ---- stage 1: retrieve
const t0 = Date.now();
const g = await retrievePremise(premise, apiKey, MODEL);
console.log(`\nSTAGE 1 · retrieved in ${Date.now() - t0}ms`);
console.log('  searches run: ' + (g.searchQueries.join(' | ') || '(none reported)'));
console.log('  pages consulted: ' + g.chunks.length);
g.chunks.slice(0, 12).forEach((c, i) => console.log(`    ${i + 1}. ${c.title ?? '(untitled)'}`));

// ---- structure the prose into sources, with the real URLs to choose from
const provider = new GeminiProvider();
const t1 = Date.now();
const structured = await provider.complete({
  operation: 'synthesize',
  model: MODEL,
  systemInstruction:
    'You convert a research note into JSON. Use ONLY what the note says. Never add a source, a ' +
    'quote or a URL that is not in it. Copy quotes character for character. If the note gives no ' +
    'exact wording for a position, omit the quote field entirely rather than paraphrasing into ' +
    'quotation marks. Return {"status":"contested"|"settled"|"unsettled","statusLine":"...",' +
    '"sources":[{"who":"...","publication":"...","position":"...","quote":"...","url":"..."}]}',
  messages: [{
    role: 'user',
    content: `RESEARCH NOTE:\n${g.text}\n\nURLS CONSULTED (use only these):\n${g.chunks.map((c, i) => `${i + 1}. ${c.uri}`).join('\n')}`,
  }],
  responseFormat: 'json',
  temperature: 0,
  thinkingBudget: 0,
  maxTokens: 3072,
}, apiKey);

let parsed: { status?: string; statusLine?: string; sources?: GroundedSource[] };
try {
  parsed = JSON.parse(structured.content.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
} catch {
  console.error('\ncould not parse structuring pass:\n' + structured.content.slice(0, 400));
  process.exit(1);
}
console.log(`\nSTAGE 2 · structured in ${Date.now() - t1}ms`);
console.log(`  STATUS: ${(parsed.status ?? '?').toUpperCase()}`);
console.log('  ' + (parsed.statusLine ?? ''));

// ---- stage 3: verify every quote against its own page
const t2 = Date.now();
const checked = await verifySources(parsed.sources ?? []);
console.log(`\nSTAGE 3 · verified ${checked.length} sources in ${Date.now() - t2}ms\n`);

const kept = checked.filter((s) => s.verified);
const lost = checked.filter((s) => !s.verified);

console.log(`  SURVIVED THE GATE: ${kept.length}`);
kept.forEach((s) => {
  console.log(`\n    ${s.who}${s.publication ? ' · ' + s.publication : ''}`);
  console.log(`    ${s.position}`);
  console.log(`    "${s.quote}"`);
  console.log(`    ${s.resolvedUrl ?? s.url}`);
});

console.log(`\n  DROPPED: ${lost.length}`);
lost.forEach((s) => {
  console.log(`    ${s.who}: ${s.verifyNote}`);
});
console.log('');
