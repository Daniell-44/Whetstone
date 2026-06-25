/**
 * Quote provenance check — confirm every ::takes / position quote in a briefing
 * is actually present at its source URL. Run before publishing.
 *
 * Usage:
 *   pnpm tsx scripts/verify-quotes.ts            # all briefings
 *   pnpm tsx scripts/verify-quotes.ts <slug>     # one briefing
 *
 * Exits non-zero if any quote is unverified, so it can gate a publish.
 * (Placeholder quotes against homepage URLs will correctly show as NOT FOUND /
 * UNREACHABLE — that is the point: they aren't real verbatim citations yet.)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { parseBriefingFile } from '../functions/_lib/briefing/parse';
import { collectQuoteChecks, quoteMatch } from '../functions/_lib/briefing/verify-quotes';
import { fetchAndExtract } from '../functions/_lib/extract/article';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '..', 'src', 'content', 'briefings');

async function main(): Promise<void> {
  const arg = process.argv[2];
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.md') && (!arg || f === `${arg}.md`));

  if (files.length === 0) {
    console.error(`No briefing .md found${arg ? ` for "${arg}"` : ''} in ${DIR}`);
    process.exit(1);
  }

  const bodyCache = new Map<string, string | null>();
  let pass = 0;
  let fuzzy = 0;
  let fail = 0;

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const briefing = parseBriefingFile(fs.readFileSync(path.join(DIR, file), 'utf8'), slug);
    const checks = collectQuoteChecks(briefing);

    console.log(`\n=== ${slug} — ${checks.length} quote(s) to verify ===`);
    if (checks.length === 0) {
      console.log('  (nothing machine-checkable: add quote= to positions, or a ::takes block)');
      continue;
    }

    for (const c of checks) {
      let body = bodyCache.get(c.url);
      if (body === undefined) {
        const res = await fetchAndExtract(c.url);
        body = res.ok ? res.article.text : null;
        bodyCache.set(c.url, body);
      }

      if (body === null) {
        console.log(`  ✗ UNREACHABLE  ${c.where}  <${c.url}>`);
        fail += 1;
        continue;
      }

      const m = quoteMatch(c.quote, body);
      if (m === 'exact') {
        console.log(`  ✓ verbatim     ${c.where}`);
        pass += 1;
      } else if (m === 'fuzzy') {
        console.log(`  ~ near-match   ${c.where}  (edges differ — eyeball it)`);
        fuzzy += 1;
      } else {
        console.log(`  ✗ NOT FOUND    ${c.where}  <${c.url}>`);
        console.log(`      “${c.quote.slice(0, 90)}${c.quote.length > 90 ? '…' : ''}”`);
        fail += 1;
      }
    }
  }

  console.log(`\nSummary: ${pass} verbatim · ${fuzzy} near · ${fail} unverified.`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
