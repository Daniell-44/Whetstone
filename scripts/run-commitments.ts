import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectCommitments } from '../functions/_lib/philosophical-commitments/engine';
import { GeminiProvider } from '../functions/_lib/providers/gemini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, '..');
const FIXTURES = join(ROOT, 'functions/_lib/philosophical-commitments/fixtures');
const OUTPUT   = join(ROOT, 'commitments-output.json');

function loadDevVars(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#'))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]; })
        .filter(([k]) => k.length > 0),
    );
  } catch { return {}; }
}

const devVars   = loadDevVars(join(ROOT, '.dev.vars'));
const apiKeyRaw = process.env.GEMINI_API_KEY ?? devVars.GEMINI_API_KEY;

if (!apiKeyRaw) {
  console.error('GEMINI_API_KEY is not set. Add it to .dev.vars or set it as an environment variable.');
  process.exit(1);
}

const apiKey: string = apiKeyRaw;

const provider = new GeminiProvider();
const deps     = { provider, apiKey };

async function run() {
  const fixtures = [
    { name: 'helmet-law-argument', file: 'helmet-law-argument.txt' },
  ];

  const results: Record<string, unknown> = {};

  for (const { name, file } of fixtures) {
    console.log(`\nDetecting philosophical commitments in "${name}"…`);
    const text = readFileSync(join(FIXTURES, file), 'utf-8');
    try {
      const { result, inputTokens, outputTokens } = await detectCommitments(text, deps);
      results[name] = result;
      console.log(`  ethical:        ${result.ethical ? `${result.ethical.framework} (${result.ethical.confidence}%)` : 'null'}`);
      console.log(`  epistemic:      ${result.epistemic ? `${result.epistemic.framework} (${result.epistemic.confidence}%)` : 'null'}`);
      console.log(`  political:      ${result.political ? `${result.political.framework} (${result.political.confidence}%)` : 'null'}`);
      console.log(`  methodological: ${result.methodological ? `${result.methodological.framework} (${result.methodological.confidence}%)` : 'null'}`);
      console.log(`  alternatives:   ${result.alternativePerspectives.length}`);
      console.log(`  notes:          ${result.notes ?? '(none)'}`);
      console.log(`  tokens:         ${inputTokens} in / ${outputTokens} out`);
    } catch (err) {
      results[name] = { error: err instanceof Error ? err.message : String(err) };
      console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nFull output written to commitments-output.json`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
