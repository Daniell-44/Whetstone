/**
 * What does a longer wait actually buy?
 *
 *   pnpm tsx scripts/bench-outline.ts
 *
 * Daniel, 2026-08-13: "is there utility in a slightly longer wait time for the
 * first ouput to increase accuracy? i basically want to know the relationship
 * between time, output quality and cost."
 *
 * Stage 1 is the only call the reader actually waits on. Everything after it
 * happens while there is already something on screen, so seconds spent there
 * are not felt the same way. That makes the outline's thinking budget the one
 * knob worth measuring properly.
 *
 * QUALITY IS SCORED MECHANICALLY, NOT BY A MODEL. Asking a model to rate
 * another model's output produces a number that moves for reasons nobody can
 * inspect. What matters downstream is whether a claim can be SEARCHED FOR, and
 * that has observable features: it names somebody, it carries a figure with a
 * unit, and it does not lean on "this" or "the report" to say what it is about.
 * Those are the exact properties the retrieval prompt demands, so a claim that
 * scores badly here is a claim that will fail to retrieve later.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GeminiProvider } from '../functions/_lib/providers/gemini';
import { extractOutline, type MiniOutline } from '../functions/_lib/premise/mini';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function devVars(p: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(p, 'utf-8').split('\n').filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string]; }),
    );
  } catch { return {}; }
}
const apiKey = process.env.GEMINI_API_KEY ?? devVars(join(ROOT, '.dev.vars')).GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

// Three argued pieces across the beats this publication actually covers, all
// written for this benchmark so no publisher's text is being copied around.
// They differ in how HARD the claims are to pull out: the nuclear one states
// its figures, the football one buries them in narrative, the psychology one
// leans on a study it never names, which is the case that punishes a shallow read.
const ARTICLES: { name: string; text: string }[] = [
  {
    name: 'energy · figures stated plainly',
    text: `Australia should build nuclear power, and the costings debate has been settled in its favour.
Frontier Economics found that a nuclear-inclusive grid is 25 per cent cheaper than the renewables-only
pathway AEMO has planned for. That figure holds because reactors run about 90 per cent of the time,
far above what wind and solar manage even with storage, and because the build cost is spread across a
fifty year operating life rather than the shorter horizons critics prefer. CSIRO's GenCost report is
often cited against this, but GenCost prices each technology on its own and admits it cannot be used
to compare whole pathways.`,
  },
  {
    name: 'football finance · figures buried in narrative',
    text: `Chelsea's spending under Todd Boehly has been called reckless, but the accounting is smarter than
the headlines suggest. By handing players contracts running eight years and more, the club spread each
transfer fee across the full length of the deal, cutting the annual charge that counts against
profitability rules to a fraction of what a conventional five year deal would carry. UEFA has since
capped amortisation at five years, but the deals signed before that change were legal when struck and
remain on the books. Selling the club's hotels to a sister company booked a profit of over seventy
million pounds in a single year, and while the Premier League questioned it, the transaction stood.
None of this is cheating. It is reading the rulebook more carefully than rivals did.`,
  },
  {
    name: 'psychology · leans on an unnamed study',
    text: `Remote work has quietly destroyed the thing that made offices worth the rent. A recent study of
a large technology firm found that after the shift to fully remote work, collaboration networks became
more siloed and the number of connections bridging separate teams fell sharply. Workers spent more
hours in scheduled meetings and fewer in the unplanned conversations where genuinely new ideas come
from. Output did not fall, which is why executives were slow to notice, but the kind of output changed:
more incremental improvement, less of the cross-pollination that produces anything unexpected. The
research suggests the cost of remote work is not productivity but originality, and it will take years
to show up in any measure a chief financial officer looks at.`,
  },
];

const BUDGETS = [0, 512, 2048, 8192];

// Temperature is zero, but thinking is not deterministic, and a default was
// about to be set off one sample per cell. Three passes over three articles is
// nine runs per budget: still small, but enough that a two-second difference
// is not just one unlucky call.
const REPEATS = 3;

// ---- mechanical quality scoring -------------------------------------------

const UNIT = /(\bper cent\b|%|\$|£|€|\bdollars?\b|\bpounds?\b|\byears?\b|\bmonths?\b|\bhours?\b|\bmegawatts?\b|\bMW\b|\btimes\b|\bper year\b|\bmillion\b|\bbillion\b|\bthousand\b)/i;
const FIGURE = /(\b\d[\d,.]*\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b)/i;
// Words that point at something the sentence never names. A claim built on
// these cannot be searched for, because the search box has no idea what "the
// study" is.
const DEIXIS = /(\bthis\b|\bthese\b|\bthose\b|\bit\b|\bthey\b|\bthe (study|report|research|firm|club|company|paper|figure)\b)/i;

interface Score { named: boolean; quantified: boolean; deictic: boolean; words: number; points: number }

function scoreClaim(claim: string): Score {
  // A proper noun that is not simply the first word of the sentence.
  const named = /\s[A-Z][A-Za-z'&.-]{2,}/.test(claim);
  const quantified = FIGURE.test(claim) && UNIT.test(claim);
  const deictic = DEIXIS.test(claim);
  const words = claim.trim().split(/\s+/).length;
  // Two ways to be checkable, one way to be useless. Naming and quantifying are
  // each worth a point because either alone gives a searcher something to grip.
  const points = (named ? 1 : 0) + (quantified ? 1 : 0) - (deictic ? 1 : 0);
  return { named, quantified, deictic, words, points };
}

function scoreOutline(o: MiniOutline): { avg: number; claims: Score[]; checkable: number } {
  const claims = o.claims.map((c) => scoreClaim(c.claim));
  const total = claims.reduce((a, s) => a + s.points, 0);
  return {
    avg: claims.length ? total / claims.length : 0,
    claims,
    // A claim is CHECKABLE if a stranger could go and look it up: it names
    // something or carries a figure, and it does not lean on an unnamed noun.
    checkable: claims.filter((s) => (s.named || s.quantified) && !s.deictic).length,
  };
}

// Gemini 2.5 Flash list prices, 13 August 2026. Thinking tokens bill as output.
const IN_PER_M = 0.30, OUT_PER_M = 2.50;

interface Row {
  article: string; budget: number; ms: number; claims: number;
  checkable: number; avg: number; inTok: number; outTok: number; cost: number;
}
const rows: Row[] = [];

const provider = new GeminiProvider();

for (let rep = 0; rep < REPEATS; rep++) {
  for (const art of ARTICLES) {
    for (const budget of BUDGETS) {
      const t0 = Date.now();
      const r = await extractOutline(art.text, { provider, apiKey, outlineThinking: budget });
      const ms = Date.now() - t0;
      const s = scoreOutline(r.outline);
      const cost = (r.inTok / 1e6) * IN_PER_M + (r.outTok / 1e6) * OUT_PER_M;
      rows.push({
        article: art.name, budget, ms, claims: r.outline.claims.length,
        checkable: s.checkable, avg: s.avg, inTok: r.inTok, outTok: r.outTok, cost,
      });

      if (rep === 0) {
        console.log(`\n${'='.repeat(78)}`);
        console.log(`${art.name}  ·  thinking ${budget}`);
        console.log(`${'='.repeat(78)}`);
        console.log(`  ${(ms / 1000).toFixed(1)}s · ${r.outTok} out tokens · $${cost.toFixed(5)}`);
        console.log(`  CONCLUDES: ${r.outline.conclusion || '(none)'}`);
        r.outline.claims.forEach((c, i) => {
          const sc = s.claims[i];
          const marks = [sc.named ? 'names' : '', sc.quantified ? 'figure' : '', sc.deictic ? 'VAGUE' : ''].filter(Boolean).join(' ');
          console.log(`    ${i + 1}. [${marks || 'nothing to grip'}] ${c.claim}`);
        });
      } else {
        process.stdout.write('.');
      }
    }
  }
}
console.log(`\n\n(${REPEATS} passes over ${ARTICLES.length} articles = ${REPEATS * ARTICLES.length} runs per budget)`);

// ---- the summary that answers the question --------------------------------

console.log(`\n\n${'='.repeat(78)}`);
console.log('TIME, QUALITY, COST');
console.log('='.repeat(78));
console.log('\n  budget    secs   claims  checkable   score   out tok      cost');
console.log('  ' + '-'.repeat(62));
for (const b of BUDGETS) {
  const r = rows.filter((x) => x.budget === b);
  const n = r.length;
  const avg = (f: (x: Row) => number) => r.reduce((a, x) => a + f(x), 0) / n;
  console.log(
    `  ${String(b).padStart(6)}  ${(avg((x) => x.ms) / 1000).toFixed(1).padStart(6)}  ` +
    `${avg((x) => x.claims).toFixed(1).padStart(7)}  ${avg((x) => x.checkable).toFixed(1).padStart(9)}  ` +
    `${avg((x) => x.avg).toFixed(2).padStart(6)}  ${avg((x) => x.outTok).toFixed(0).padStart(7)}  ` +
    `$${avg((x) => x.cost).toFixed(5)}`,
  );
}

// Everything below is PER RUN, so the numbers mean the same thing whether the
// benchmark ran once or thirty times.
const mean = (b: number, f: (x: Row) => number) => {
  const r = rows.filter((x) => x.budget === b);
  return r.reduce((a, x) => a + f(x), 0) / r.length;
};
const baseMs = mean(0, (x) => x.ms);
const baseCheck = mean(0, (x) => x.checkable);
const baseScore = mean(0, (x) => x.avg);
const baseCost = mean(0, (x) => x.cost);

console.log('\n  AGAINST NO THINKING AT ALL, PER RUN');
for (const b of BUDGETS.filter((x) => x > 0)) {
  const dSec = (mean(b, (x) => x.ms) - baseMs) / 1000;
  const dCheck = mean(b, (x) => x.checkable) - baseCheck;
  const dScore = mean(b, (x) => x.avg) - baseScore;
  const dCost = mean(b, (x) => x.cost) - baseCost;
  console.log(
    `    ${String(b).padStart(5)}:  ${dSec >= 0 ? '+' : ''}${dSec.toFixed(1)}s   ` +
    `${dCheck >= 0 ? '+' : ''}${dCheck.toFixed(2)} checkable   ` +
    `${dScore >= 0 ? '+' : ''}${dScore.toFixed(2)} quality per claim   ` +
    `${dCost >= 0 ? '+' : ''}$${dCost.toFixed(5)}`,
  );
}

// The comparison that decides it. Stage 1 is about one per cent of a run, so
// the money never chooses here: seconds do.
const RUN_TOTAL = 0.081;
console.log(`\n  Stage 1 is ${((mean(0, (x) => x.cost) / RUN_TOTAL) * 100).toFixed(1)}% of a $${RUN_TOTAL.toFixed(3)} run at no thinking, ` +
  `${((mean(8192, (x) => x.cost) / RUN_TOTAL) * 100).toFixed(1)}% at the most. Cost is not the constraint here. Time is.`);
console.log('');
