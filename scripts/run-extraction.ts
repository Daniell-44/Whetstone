import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractArgument } from '../functions/_lib/argument-extraction/engine';
import { GeminiProvider } from '../functions/_lib/providers/gemini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, '..');
const FIXTURES = join(ROOT, 'functions/_lib/argument-extraction/fixtures');
const OUTPUT   = join(ROOT, 'extraction-output.json');

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
    { name: 'social-media-draft', file: 'social-media-draft.txt' },
  ];

  const results: Record<string, unknown> = {};

  for (const { name, file } of fixtures) {
    console.log(`\nExtracting argument from "${name}"…`);
    const text = readFileSync(join(FIXTURES, file), 'utf-8');
    try {
      const { result, inputTokens, outputTokens } = await extractArgument(text, deps);
      results[name] = result;
      console.log(`  centralClaim: ${result.centralClaim}`);
      console.log(`  statements:   ${result.statements.length} (${result.statements.filter(s => s.type === 'premise').length} premises, ${result.statements.filter(s => s.type === 'conclusion').length} conclusions)`);
      console.log(`  confidence:   ${result.confidence}%`);
      console.log(`  notes:        ${result.notes ?? '(none)'}`);
      console.log(`  tokens:       ${inputTokens} in / ${outputTokens} out`);
    } catch (err) {
      results[name] = { error: err instanceof Error ? err.message : String(err) };
      console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nFull output written to extraction-output.json`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
