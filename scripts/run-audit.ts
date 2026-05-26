import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { auditText } from '../functions/_lib/audit/engine';
import { GeminiProvider } from '../functions/_lib/providers/gemini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES   = join(__dirname, '../functions/_lib/audit/fixtures');
const OUTPUT     = join(__dirname, '../audit-output.json');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY environment variable is required.');
  process.exit(1);
}

const provider = new GeminiProvider();
const deps     = { provider, apiKey };

async function run() {
  const fixtures = [
    { name: 'fallacy-heavy', file: 'fallacy-heavy.txt' },
    { name: 'clean-argument', file: 'clean-argument.txt' },
  ];

  const results: Record<string, unknown> = {};

  for (const { name, file } of fixtures) {
    console.log(`\nAuditing "${name}"…`);
    const text = readFileSync(join(FIXTURES, file), 'utf-8');
    try {
      const result = await auditText(text, deps);
      results[name] = result;
      console.log(`  centralClaim: ${result.audit.centralClaim}`);
      console.log(`  fallacies:    ${result.audit.namedFallacies.length}`);
      console.log(`  loadedLang:   ${result.audit.loadedLanguage.length}`);
      console.log(`  tokens:       ${result.inputTokens} in / ${result.outputTokens} out`);
    } catch (err) {
      results[name] = { error: err instanceof Error ? err.message : String(err) };
      console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  writeFileSync(OUTPUT, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nFull output written to audit-output.json`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
