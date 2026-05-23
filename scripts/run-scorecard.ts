// Local runner — loads the sample fixture and calls generateScorecard against
// the real Gemini API. Reads GEMINI_API_KEY from the environment or .dev.vars.
// Output is written to scorecard-output.json (gitignored).
//
// Usage:
//   npm run scorecard:demo
//   GEMINI_API_KEY=xxx npm run scorecard:demo

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname }               from 'node:path';
import { fileURLToPath }               from 'node:url';

import { GeminiProvider }    from '../functions/_lib/providers/gemini';
import { generateScorecard } from '../functions/_lib/scorecard/engine';
import { DebateInputSchema } from '../functions/_lib/scorecard/schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir   = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Load env — process.env first, then .dev.vars as fallback.
// ---------------------------------------------------------------------------

function parseDevVars(filePath: string): Record<string, string> {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return Object.fromEntries(
      raw
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l): [string, string] => {
          const eq  = l.indexOf('=');
          const key = l.slice(0, eq).trim();
          const val = l.slice(eq + 1).trim();
          return [key, val];
        })
        .filter(([k]) => k.length > 0),
    );
  } catch {
    return {};
  }
}

const devVars = parseDevVars(join(rootDir, '.dev.vars'));
const apiKey  = process.env.GEMINI_API_KEY ?? devVars.GEMINI_API_KEY;

if (!apiKey || apiKey === 'your-google-ai-studio-key-here') {
  console.error(
    'Error: GEMINI_API_KEY is not set or is a placeholder.\n' +
    'Set it in .dev.vars or as an environment variable:\n' +
    '  GEMINI_API_KEY=xxx npm run scorecard:demo',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load fixture.
// ---------------------------------------------------------------------------

const fixturePath = join(rootDir, 'functions/_lib/scorecard/fixtures/sample-debate.json');
const raw         = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;

const validated = DebateInputSchema.safeParse(raw);
if (!validated.success) {
  console.error('Fixture failed validation:', validated.error.message);
  process.exit(1);
}

const input = validated.data;

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

console.log(`Running scorecard synthesis for: "${input.question}"\n`);
console.log(`Positions: ${input.positions.map((p) => p.label).join(' | ')}\n`);

const startMs = Date.now();

const { scorecard, usage } = await generateScorecard(input, {
  provider: new GeminiProvider(),
  apiKey,
});

const elapsedMs = Date.now() - startMs;

// ---------------------------------------------------------------------------
// Output.
// ---------------------------------------------------------------------------

const outPath = join(rootDir, 'scorecard-output.json');
writeFileSync(outPath, JSON.stringify(scorecard, null, 2));

console.log('=== Scorecard ===');
console.log(JSON.stringify(scorecard, null, 2));
console.log('\n=== Token Usage ===');
console.log(`Input tokens:  ${usage.inputTokens}`);
console.log(`Output tokens: ${usage.outputTokens}`);
console.log(`Elapsed:       ${elapsedMs}ms`);
console.log(`\nOutput written to: ${outPath}`);
