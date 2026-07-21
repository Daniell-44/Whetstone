// Draft validation harness: run the REAL briefing parser over the drafts so
// format drift surfaces before Daniel edits, not at publish time.
//   pnpm exec tsx drafts/check-drafts.ts
import { readFileSync } from 'fs';
import { parseBriefingFile, validateBriefing } from '../functions/_lib/briefing/parse';

for (const f of ['drafts/gencost-review.md', 'drafts/frontier-review.md', 'drafts/nuclear-costings-parent.md']) {
  try {
    const b = parseBriefingFile(readFileSync(f, 'utf8'), f.split('/').pop()!.replace('.md', ''));
    const w = validateBriefing(b);
    console.log(`${f} => parsed OK`);
    console.log(`  blocks: ${b.blocks.map((x) => x.type).join(', ')}`);
    console.log(`  plotted positions: ${(b.positionSources ?? []).length}, evidence: ${(b.evidenceSources ?? []).length}`);
    console.log(`  warnings: ${w.length ? '\n    - ' + w.join('\n    - ') : 'none'}`);
  } catch (e) {
    console.log(`${f} => PARSE FAILED: ${(e as Error).message}`);
  }
}
