// Regenerate cached audit + extraction results for the three Studio samples.
// Run after engine prompt changes that affect output shape.
//
//   npm run regen:samples
//
// Reads sample texts from src/data/samples/{helmets,study-abstract,polemic}.ts,
// runs the real engine, and prints suggested replacement constants to stdout.
// Manual paste — keeps the regeneration explicit rather than auto-overwriting.

import { GeminiProvider } from '../functions/_lib/providers/gemini';
import { auditText } from '../functions/_lib/audit/engine';
import { extractArgument } from '../functions/_lib/argument-extraction/engine';
import { SAMPLES } from '../src/data/samples';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not set in environment');
  process.exit(1);
}

const provider = new GeminiProvider();

async function regen() {
  for (const sample of SAMPLES) {
    console.log(`\n=== ${sample.id} (${sample.shortLabel}) ===\n`);

    const [auditResult, extractionResult] = await Promise.all([
      auditText(sample.text, { provider, apiKey: apiKey!, includePhase2: true }),
      extractArgument(sample.text, { provider, apiKey: apiKey! }),
    ]);

    console.log(`// === ${sample.id} cached ===`);
    console.log('audit:');
    console.log(JSON.stringify(auditResult.audit, null, 2));
    console.log('\nextraction:');
    console.log(JSON.stringify(extractionResult.result, null, 2));
  }
}

regen().catch(err => {
  console.error('Regen failed:', err);
  process.exit(1);
});
