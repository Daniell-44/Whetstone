// Local runner — loads the sample fixture and calls generateScorecard against
// the real Gemini API. Reads GEMINI_API_KEY from the environment or .dev.vars.
// Output is written to scorecard-output.json (gitignored).
//
// Fallback: if Stage 2 (gemini-2.5-pro) is overloaded even after backoff,
// retries once with gemini-2.5-flash and prints a clearly labelled banner.
// The _stage2Model field in the output file records which model actually ran.
//
// Usage:
//   npm run scorecard:demo
//   GEMINI_API_KEY=xxx npm run scorecard:demo

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname }               from 'node:path';
import { fileURLToPath }               from 'node:url';

import { GeminiProvider }    from '../functions/_lib/providers/gemini';
import { ProviderError }     from '../functions/_lib/providers/types';
import { generateScorecard } from '../functions/_lib/scorecard/engine';
import { DebateInputSchema } from '../functions/_lib/scorecard/schemas';
import type { Scorecard }    from '../functions/_lib/scorecard/types';

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

const input    = validated.data;
const provider = new GeminiProvider();

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function isOverloadError(err: unknown): boolean {
  // Retryable provider errors that the engine already exhausted backoff on.
  if (!(err instanceof ProviderError)) return false;
  return err.kind === 'rate_limited' ||
    (err.kind === 'provider_error' && (err.status === undefined || err.status >= 500)) ||
    err.kind === 'network';
}

// ---------------------------------------------------------------------------
// Run — with flash fallback on overload.
// ---------------------------------------------------------------------------

console.log(`Running scorecard synthesis for: "${input.question}"\n`);
console.log(`Positions: ${input.positions.map((p) => p.label).join(' | ')}\n`);

const startMs = Date.now();

type OutputData = Scorecard & { _stage2Model?: string };
let output: OutputData;
let usage: { inputTokens: number; outputTokens: number };
let stage2ModelUsed: string | undefined;

try {
  ({ scorecard: output, usage } = await generateScorecard(input, { provider, apiKey }));
} catch (err) {
  if (!isOverloadError(err)) {
    // Hard error (auth, bad request, validation) — nothing to fall back to.
    console.error('Fatal error (not an overload):', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.error(
    `\nStage 2 overloaded after backoff: ${err instanceof Error ? err.message : err}\n` +
    'Retrying once with gemini-2.5-flash as Stage 2 fallback…\n',
  );

  try {
    ({ scorecard: output, usage } = await generateScorecard(input, {
      provider,
      apiKey,
      stage2Model: 'gemini-2.5-flash',
    }));
    stage2ModelUsed = 'gemini-2.5-flash';
  } catch (fallbackErr) {
    console.error(
      'Flash fallback also failed:',
      fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
    );
    process.exit(1);
  }
}

const elapsedMs = Date.now() - startMs;

if (stage2ModelUsed) {
  output = { ...output, _stage2Model: stage2ModelUsed };
  console.log(
    '\n╔══════════════════════════════════════════════════════════════════════╗\n' +
    '║  STAGE 2 RAN ON FLASH FALLBACK                                       ║\n' +
    '║  meta-analysis quality not representative of production              ║\n' +
    '╚══════════════════════════════════════════════════════════════════════╝\n',
  );
}

// ---------------------------------------------------------------------------
// Output.
// ---------------------------------------------------------------------------

const outPath = join(rootDir, 'scorecard-output.json');
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log('=== Scorecard ===');
console.log(JSON.stringify(output, null, 2));
console.log('\n=== Token Usage ===');
console.log(`Input tokens:  ${usage!.inputTokens}`);
console.log(`Output tokens: ${usage!.outputTokens}`);
console.log(`Elapsed:       ${elapsedMs}ms`);
console.log(`Stage 2 model: ${stage2ModelUsed ?? 'gemini-2.5-pro (production)'}`);
console.log(`\nOutput written to: ${outPath}`);
