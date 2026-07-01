/**
 * Port a legacy scorecard (src/data/scorecards.ts) into a briefing `.md` DRAFT
 * in the new format. Mechanical transform only:
 *   - positions        -> ::position paragraphs (bestCase claim+grounds) + ::audit (fatalFlaw)
 *   - position sources -> ::sources spectrum rows (leaning from the position)
 *   - metaAnalysis     -> ::shared
 * It writes NO verbatim quotes (scorecards are reconstructions, not quotes) and
 * NO ::editor — add those afterwards by hand via the sourcing flow. The output
 * is a starting point the author refines, not a finished briefing.
 *
 * Usage:
 *   pnpm tsx scripts/scorecard-to-briefing.ts <slug>   # one
 *   pnpm tsx scripts/scorecard-to-briefing.ts --all    # every not-yet-ported scorecard
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scorecards } from '../src/data/scorecards';
import type { Scorecard } from '../functions/_lib/scorecard/types';

// Already migrated to hand-authored briefings — never overwrite these.
const ALREADY_PORTED = new Set(['minimum-wage-employment', 'ai-creative-jobs']);

function idFrom(s: string): string {
  return (s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 2).join('') || 'src').slice(0, 14);
}
function sideFor(leaning: number): 'left' | 'mid' | 'right' {
  return leaning <= -20 ? 'left' : leaning >= 20 ? 'right' : 'mid';
}
const q = (s: string) => s.replace(/"/g, '').replace(/\s+/g, ' ').trim();

function toBriefing(sc: Scorecard): string {
  const used = new Set<string>();
  const sources: string[] = [];
  const firstSourceId: string[] = [];

  sc.positions.forEach((pos, pi) => {
    const leaning = pos.leaning ?? 0;
    pos.sources.forEach((src, si) => {
      let id = idFrom(src.publication || src.title);
      let n = 1;
      while (used.has(id)) id = idFrom(src.publication || src.title) + ++n;
      used.add(id);
      if (si === 0) firstSourceId[pi] = id;
      sources.push(`${id} | ${q(src.title)} | ${q(src.publication)} | ${src.url} | ${leaning} | ${sideFor(leaning)}`);
    });
  });

  const fm = [
    '---',
    `question: ${sc.question}`,
    sc.category ? `category: ${sc.category}` : '',
    sc.spectrumAxis ? `axisLeft: ${sc.spectrumAxis.left}` : '',
    sc.spectrumAxis ? `axisRight: ${sc.spectrumAxis.right}` : '',
    `publishedDate: ${sc.publishedDate}`,
    '---',
  ].filter(Boolean);

  const out: string[] = [...fm, '', '::sources', ...sources, '', '::landscape', sc.dek, ''];

  sc.positions.forEach((pos, pi) => {
    out.push(`::position colour=${pi} source=${firstSourceId[pi] ?? ''} label="${q(pos.label)}"`);
    out.push(`${pos.bestCase.claim} ${pos.bestCase.grounds}`);
    out.push(`::audit name="${q(pos.fatalFlaw.name)}" kind=structural`);
    out.push(pos.fatalFlaw.explanation, '');
  });

  out.push('::shared', `${sc.metaAnalysis.bridgingWarrant} ${sc.metaAnalysis.explanation}`);
  return out.join('\n').trimEnd() + '\n';
}

const arg = process.argv[2];
if (!arg) { console.error('Pass a scorecard slug, or --all.'); process.exit(1); }
const targets = scorecards.filter((sc) =>
  arg === '--all' ? !ALREADY_PORTED.has(sc.slug) : sc.slug === arg,
);
if (targets.length === 0) { console.error(`No scorecard matched "${arg}".`); process.exit(1); }

const DIR = path.resolve(process.cwd(), 'src', 'content', 'briefings');
for (const sc of targets) {
  if (ALREADY_PORTED.has(sc.slug)) { console.log(`skip ${sc.slug} (already hand-authored)`); continue; }
  const md = toBriefing(sc);
  const dest = path.join(DIR, `${sc.slug}.md`);
  fs.writeFileSync(dest, md, 'utf8');
  console.log(`wrote src/content/briefings/${sc.slug}.md  (${sc.positions.length} positions)`);
}
