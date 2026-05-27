import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateCounterarguments } from '../functions/_lib/counterargument/engine';
import { GeminiProvider } from '../functions/_lib/providers/gemini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const FIXTURE   = join(ROOT, 'functions/_lib/counterargument/fixtures/op-ed-draft.txt');
const OUTPUT    = join(ROOT, 'counterargument-output.json');

// ---------------------------------------------------------------------------
// Load API key — process.env first, then .dev.vars as fallback.
// ---------------------------------------------------------------------------

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

const provider = new GeminiProvider();
const apiKey: string = apiKeyRaw;

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function run() {
  console.log('Loading fixture: op-ed-draft.txt');
  const text = readFileSync(FIXTURE, 'utf-8');
  console.log(`Text length: ${text.length} characters\n`);
  console.log('Calling generateCounterarguments (gemini-2.5-pro + 8192 thinking budget)…\n');

  try {
    const { result, inputTokens, outputTokens } = await generateCounterarguments(text, { provider, apiKey });

    console.log(`Central claim: ${result.centralClaim}`);
    console.log(`Counterarguments: ${result.counterarguments.length}`);
    result.counterarguments.forEach((c, i) => {
      console.log(`  [${i + 1}] ${c.position.slice(0, 90)}${c.position.length > 90 ? '…' : ''}`);
    });
    console.log(`Notes: ${result.notes ?? '(none)'}`);
    console.log(`Tokens: ${inputTokens} in / ${outputTokens} out`);

    const output = { result, usage: { inputTokens, outputTokens } };
    writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\nFull output written to counterargument-output.json`);
  } catch (err) {
    console.error('ERROR:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

run();
