/**
 * Demo script: runs the citation audit engine on the sample fixture and
 * writes the output to citation-audit-output.json.
 *
 * Usage:
 *   npm run citation:demo
 *
 * NOTE: All URLs in the fixture are example.org placeholders that will
 * return connection errors. The engine correctly marks these as "unfetchable"
 * — that is the realistic and expected outcome for a demo run on placeholder
 * citations. Uncited claims (no URL at all) are marked "uncited" without any
 * fetch attempt, which also demonstrates correct engine behaviour.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// Lazy import so the script can be run without the full Astro build.
const { auditCitations } = await import('../functions/_lib/citation-audit/engine.js');
const { SAMPLE_DRAFT }   = await import('../functions/_lib/citation-audit/fixtures/sample-draft.js');
const { fetchAndExtract } = await import('../functions/_lib/extract/article.js');

// ---------------------------------------------------------------------------
// Minimal Gemini provider (re-uses the same provider the app uses)
// ---------------------------------------------------------------------------

const { GeminiProvider } = await import('../functions/_lib/providers/gemini.js');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY environment variable is required.');
  process.exit(1);
}

console.log('Running citation audit on sample fixture…\n');
console.log('(Fixture URLs are example.org placeholders — expect "unfetchable" verdicts)\n');

const provider = new GeminiProvider();

const start = Date.now();
const output = await auditCitations(SAMPLE_DRAFT, {
  provider,
  apiKey,
  extractor: fetchAndExtract,
});
const elapsed = Date.now() - start;

// ---------------------------------------------------------------------------
// Pretty-print summary to stdout
// ---------------------------------------------------------------------------

console.log(`Completed in ${(elapsed / 1000).toFixed(1)}s\n`);
console.log('=== Summary ===');
const { summary } = output.result;
console.log(`  Total claims:    ${summary.total}`);
console.log(`  Well cited:      ${summary.wellCited}`);
console.log(`  Weakly cited:    ${summary.weaklyCited}`);
console.log(`  Mismatched:      ${summary.mismatched}`);
console.log(`  Uncited:         ${summary.uncited}`);
console.log(`  Unfetchable:     ${summary.unfetchable}`);
console.log(`  Input tokens:    ${output.inputTokens}`);
console.log(`  Output tokens:   ${output.outputTokens}`);
console.log(`  URLs fetched:    ${output.citationsFetched}`);
console.log(`  URLs failed:     ${output.citationsFailed}`);
console.log('\n=== Claims ===');

for (const claim of output.result.factualClaims) {
  console.log(`\n[${claim.verdict.toUpperCase()}] (debug-conf ${claim._debugConfidence ?? '?'}%)`);
  console.log(`  Claim:   ${claim.claim}`);
  console.log(`  URL:     ${claim.citationUrl ?? '(none)'}`);
  console.log(`  Reason:  ${claim.verdictExplanation}`);
  if (claim.sourceExcerpt) {
    console.log(`  Excerpt: "${claim.sourceExcerpt}"`);
  }
}

// ---------------------------------------------------------------------------
// Write full JSON output
// ---------------------------------------------------------------------------

const outPath = path.join(ROOT, 'citation-audit-output.json');
await fs.writeFile(outPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`\nFull output written to citation-audit-output.json`);
