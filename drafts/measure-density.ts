// Scannability measurement for briefing drafts. The question is not "how long
// is the article" but "how far does a scanner travel between visual anchors" -
// an anchor being anything that breaks a prose run (heading, card, quote,
// table, list). Long unbroken runs are the wall-of-text complaint, quantified.
//   pnpm exec tsx drafts/measure-density.ts
import { readFileSync } from 'fs';
import { parseBriefingFile } from '../functions/_lib/briefing/parse';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

for (const f of ['drafts/gencost-review.md', 'drafts/frontier-review.md', 'drafts/nuclear-costings-parent.md']) {
  const raw = readFileSync(f, 'utf8');
  const b = parseBriefingFile(raw, 'x');

  let total = 0;
  const runs: number[] = [];   // consecutive prose words between anchors
  let run = 0;
  const perBlock: string[] = [];

  for (const bl of b.blocks) {
    const t = bl.type;
    let w = 0;
    if (t === 'prose' || t === 'landscape' || t === 'shared') w = words((bl as any).text ?? '');
    else if (t === 'position') w = words((bl as any).paragraph ?? '');
    else if (t === 'editorView') w = words(((bl as any).text ?? '') + ' ' + ((bl as any).whyWrong ?? ''));
    total += w;
    perBlock.push(`${t}:${w}`);

    // A position block's audit card and a takes table are visual anchors; a
    // bare prose paragraph is not - it continues the run.
    if (t === 'prose' || t === 'landscape') {
      run += w;
    } else {
      run += w;
      if (run > 0) runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);

  const longest = Math.max(...runs);
  const avgRun = Math.round(runs.reduce((a, c) => a + c, 0) / runs.length);
  console.log(`\n${f}`);
  console.log(`  body words: ${total} (~${Math.ceil(total / 230)} min read)`);
  console.log(`  prose runs between visual anchors: ${runs.join(', ')}`);
  console.log(`  longest unbroken run: ${longest} words (~${Math.round(longest / 230 * 60)}s of reading with no anchor)`);
  console.log(`  average run: ${avgRun} words`);
  console.log(`  block sequence: ${perBlock.join(' | ')}`);
}
console.log('\nreference: web-readability guidance puts a comfortable scan anchor every ~150-200 words;');
console.log('a run over ~400 words with no heading, quote, or card is the "wall of text" the owner flagged.');
