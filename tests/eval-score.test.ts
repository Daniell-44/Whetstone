// Engine-eval SCORER — turns the raw harness outputs into a persistent,
// version-over-version scorecard. Deterministic + reproducible: no network, no
// live model calls, so it is safe to run any time and its numbers are auditable.
//
//   RUN_SCORE=1 pnpm exec vitest run tests/eval-score.test.ts
//
// It scores every snapshot dir in SNAPSHOTS (a labelled engine version), writes
// eval/reports/<version>.json, folds in the LLM grader verdicts from
// eval/graded/<version>.json when present, and (re)builds eval/SCORECARD.md —
// the marketing + regression artifact showing the trend baseline → today.
//
// To score a NEW engine version: run the harness into eval/outputs-<label>/,
// add a row to SNAPSHOTS, grade it (optional) into eval/graded/<label>.json,
// and re-run this file. The scorecard picks up the new column automatically.
//
// A small always-on unit block exercises the matching logic so it can't rot.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scoreItem, aggregate, overlaps, norm, tokens,
  type CorpusItem, type RunFile, type ItemScore, type Aggregate,
} from '../eval/lib/score';

const ROOT       = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_DIR = join(ROOT, 'eval', 'corpus');
const REPORTS    = join(ROOT, 'eval', 'reports');
const GRADED     = join(ROOT, 'eval', 'graded');

// Ordered oldest → newest. `dir` is under eval/. Add a row per engine version.
const SNAPSHOTS: Array<{ version: string; label: string; dir: string; stamp: string }> = [
  { version: 'baseline', label: 'Baseline (temp 0.5, hardcoded groundedness)', dir: 'outputs-baseline-20260707', stamp: '2026-07-07' },
  { version: 'e2',       label: 'E1+E2 (exhaustiveness + earned-emphasis)',     dir: 'outputs-e2',                stamp: '2026-07-07' },
  { version: 'e3',       label: 'E3 (one-finding-per-defect dedup)',            dir: 'outputs-e3',                stamp: '2026-07-08' },
  { version: 'e4',       label: 'E4+E6 (model-emitted groundedness, temp 0.2)', dir: 'outputs',                   stamp: '2026-07-08' },
];

function loadCorpus(): CorpusItem[] {
  return readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(CORPUS_DIR, f), 'utf8')) as CorpusItem);
}

function loadRuns(dir: string): Map<string, RunFile[]> {
  const abs = join(ROOT, 'eval', dir);
  const byId = new Map<string, RunFile[]>();
  if (!existsSync(abs)) return byId;
  for (const f of readdirSync(abs).filter((x) => x.endsWith('.json'))) {
    const rf = JSON.parse(readFileSync(join(abs, f), 'utf8')) as RunFile;
    if (!rf?.result?.audit) continue;
    const arr = byId.get(rf.id) ?? [];
    arr.push(rf);
    byId.set(rf.id, arr);
  }
  return byId;
}

// --- Graded (LLM) verdicts: optional, per-item, folded into the report ------

interface GradedItem {
  id: string;
  recall?: { caught: number; planted: number };          // judgment recall (defect genuinely identified)
  groundednessKind?: { correct: number; total: number };  // KIND assigned correctly (calibration)
  nameAccuracy?: { correct: number; total: number };      // fallacy named defensibly
  trapResistance?: { respected: number; total: number };  // baited non-flaws correctly left alone
}

function loadGraded(version: string): GradedItem[] | null {
  const p = join(GRADED, `${version}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')) as GradedItem[]; } catch { return null; }
}

function foldGraded(items: GradedItem[]) {
  const sum = (f: (g: GradedItem) => { n: number; d: number } | undefined) =>
    items.reduce((acc, g) => { const v = f(g); return v ? { n: acc.n + v.n, d: acc.d + v.d } : acc; }, { n: 0, d: 0 });
  const rate = (x: { n: number; d: number }) => (x.d === 0 ? null : Math.round((x.n / x.d) * 1000) / 10);
  const recall = sum((g) => g.recall && { n: g.recall.caught, d: g.recall.planted });
  const kind   = sum((g) => g.groundednessKind && { n: g.groundednessKind.correct, d: g.groundednessKind.total });
  const name   = sum((g) => g.nameAccuracy && { n: g.nameAccuracy.correct, d: g.nameAccuracy.total });
  const trap   = sum((g) => g.trapResistance && { n: g.trapResistance.respected, d: g.trapResistance.total });
  return {
    recall: { ...recall, rate: rate(recall) },
    groundednessKind: { ...kind, rate: rate(kind) },
    nameAccuracy: { ...name, rate: rate(name) },
    trapResistance: { ...trap, rate: rate(trap) },
  };
}

type GradedAgg = ReturnType<typeof foldGraded> | null;

interface Report { version: string; label: string; stamp: string; aggregate: Aggregate; graded: GradedAgg; items: ItemScore[]; coverage: number }

// --- Scorecard rendering ----------------------------------------------------

function n(x: number | null | undefined, suffix = ''): string {
  return x === null || x === undefined ? '—' : `${x}${suffix}`;
}

function renderScorecard(reports: Report[]): string {
  const cur = reports[reports.length - 1];
  const L = (r: Report) => r.version.toUpperCase();
  const row = (name: string, cell: (r: Report) => string) =>
    `| ${name} | ${reports.map(cell).join(' | ')} |`;

  const lines: string[] = [];
  lines.push('# Engine Scorecard');
  lines.push('');
  lines.push('> Auto-generated by `tests/eval-score.test.ts`. **Do not edit by hand** — re-run the scorer.');
  lines.push('> Deterministic metrics (FP, location recall, verbatim, groundedness mix, latency, consistency)');
  lines.push('> are computed from the raw outputs and are fully reproducible. Graded metrics (judgment recall,');
  lines.push('> groundedness-KIND accuracy, name accuracy, trap-resistance) come from the LLM grader and are');
  lines.push('> only present for versions that have an `eval/graded/<version>.json`.');
  lines.push('');
  lines.push(`_Current version: **${cur.label}** (${cur.stamp}) · corpus: ${cur.aggregate.nItems} items, ${cur.aggregate.nRuns} runs._`);
  lines.push('');

  // Headline card (current).
  const a = cur.aggregate;
  lines.push('## Headline (current version)');
  lines.push('');
  lines.push(`- **False positives on clean controls:** ${a.cleanControls.falsePositives} across ${a.cleanControls.nItems} clean arguments (${a.cleanControls.itemsClean}/${a.cleanControls.nItems} completely clean)`);
  lines.push(`- **Defect location recall:** ${a.detection.locatedRate}% — flagged ${a.detection.locatedTotal}/${a.detection.plantedTotal} planted defects somewhere in the audit`);
  lines.push(`- **Quote-verbatim integrity:** ${a.verbatim.passRate}% (${a.verbatim.violations} non-verbatim of ${a.verbatim.spans} spans)`);
  lines.push(`- **Groundedness mix:** ${a.groundedness.pct.structural}% Logic · ${a.groundedness.pct.interpretive}% Judgment call · ${a.groundedness.pct.empirical}% Factual`);
  if (cur.graded) {
    lines.push(`- **Judgment recall (graded):** ${n(cur.graded.recall.rate, '%')} · **Groundedness-KIND accuracy:** ${n(cur.graded.groundednessKind.rate, '%')} · **Name accuracy:** ${n(cur.graded.nameAccuracy.rate, '%')} · **Trap-resistance:** ${n(cur.graded.trapResistance.rate, '%')}`);
  }
  lines.push(`- **Latency:** mean ${a.latency.meanMs} ms · p95 ${a.latency.p95Ms} ms`);
  if (a.consistency) lines.push(`- **Run-to-run consistency:** ${a.consistency.meanJaccard} mean Jaccard over ${a.consistency.items} repeated items`);
  lines.push('');

  // Trend table.
  lines.push('## Trend');
  lines.push('');
  lines.push(`| Metric | ${reports.map(L).join(' | ')} |`);
  lines.push(`|---|${reports.map(() => '---').join('|')}|`);
  lines.push(row('Clean-control FPs', (r) => n(r.aggregate.cleanControls.falsePositives)));
  lines.push(row('Location recall %', (r) => n(r.aggregate.detection.locatedRate, '%')));
  lines.push(row('Verbatim pass %', (r) => n(r.aggregate.verbatim.passRate, '%')));
  lines.push(row('% Logic', (r) => n(r.aggregate.groundedness.pct.structural, '%')));
  lines.push(row('% Judgment call', (r) => n(r.aggregate.groundedness.pct.interpretive, '%')));
  lines.push(row('% Factual', (r) => n(r.aggregate.groundedness.pct.empirical, '%')));
  lines.push(row('Judgment recall % (graded)', (r) => n(r.graded?.recall.rate ?? null, '%')));
  lines.push(row('Groundedness-KIND acc % (graded)', (r) => n(r.graded?.groundednessKind.rate ?? null, '%')));
  lines.push(row('Trap-resistance % (graded)', (r) => n(r.graded?.trapResistance.rate ?? null, '%')));
  lines.push(row('Mean latency ms', (r) => n(r.aggregate.latency.meanMs)));
  lines.push(row('Total findings', (r) => n(r.aggregate.detection.plantedTotal >= 0 ? r.items.reduce((s, i) => s + i.findingCount, 0) : 0)));
  lines.push('');
  for (const r of reports) lines.push(`- **${L(r)}** — ${r.label} (${r.stamp})`);
  lines.push('');

  // Per-lens detection (current).
  lines.push('## Location recall by lens (current version)');
  lines.push('');
  lines.push('| Lens | Located / Planted | Rate |');
  lines.push('|---|---|---|');
  for (const [lens, r] of Object.entries(a.detection.perLens)) {
    lines.push(`| ${lens} | ${r.located} / ${r.planted} | ${r.rate}% |`);
  }
  lines.push(`| **fallacy naming** | ${a.detection.nameCorrect} / ${a.detection.nameLocated} located · ${a.detection.nameTotal} planted | ${a.detection.nameRate}% |`);
  lines.push('');

  lines.push('## Method');
  lines.push('');
  lines.push('- **Location recall** is lens-agnostic: a planted defect counts as caught if any finding, in any lens, quotes an overlapping span. Whether it landed in the ideal lens is a separate axis (name accuracy for fallacies; the grader for the rest).');
  lines.push('- **`unstatedWarrants` recall understates true recall** and should be read via the grader, not this proxy: planted warrants are abstract paraphrases (few shared tokens with any quoted span), and the engine deliberately *routes* warrant-shaped defects into the named-fallacy that already implies them (the one-finding-per-defect rule). A low warrant proxy is expected, not a regression.');
  lines.push('- **Clean-control FPs** are the honesty metric: any finding at all on an argument the author built to be clean is a false positive.');
  lines.push('- **Deterministic** metrics need no model. **Graded** metrics come from an LLM grader reading each output against the answer key; re-generate them with the grading workflow before trusting a new column.');
  lines.push('- Re-run: `RUN_SCORE=1 pnpm exec vitest run tests/eval-score.test.ts`');
  lines.push('');
  return lines.join('\n');
}

describe.runIf(process.env.RUN_SCORE === '1')('engine scorecard', () => {
  it('scores every snapshot and writes the scorecard', () => {
    const corpus = loadCorpus();
    mkdirSync(REPORTS, { recursive: true });

    const reports: Report[] = [];
    for (const snap of SNAPSHOTS) {
      const runs = loadRuns(snap.dir);
      if (runs.size === 0) { console.warn(`[score] no outputs in eval/${snap.dir} — skipping ${snap.version}`); continue; }
      const scored: ItemScore[] = [];
      for (const item of corpus) {
        if (item.category === 'smoke') continue; // smoke item has a non-standard key
        const rr = runs.get(item.id);
        if (rr && rr.length) scored.push(scoreItem(item, rr));
      }
      const agg = aggregate(snap.label, scored);
      const gradedRaw = loadGraded(snap.version);
      const graded = gradedRaw ? foldGraded(gradedRaw) : null;
      const report: Report = {
        version: snap.version, label: snap.label, stamp: snap.stamp,
        aggregate: agg, graded, items: scored, coverage: scored.length,
      };
      writeFileSync(join(REPORTS, `${snap.version}.json`), JSON.stringify(report, null, 2));
      reports.push(report);
      console.log(`[score] ${snap.version}: ${scored.length} items · FP=${agg.cleanControls.falsePositives} · recall=${agg.detection.locatedRate}% · grounded=${agg.groundedness.pct.structural}/${agg.groundedness.pct.interpretive}/${agg.groundedness.pct.empirical}`);
    }

    expect(reports.length).toBeGreaterThan(0);
    writeFileSync(join(ROOT, 'eval', 'SCORECARD.md'), renderScorecard(reports));
    console.log(`[score] wrote eval/SCORECARD.md (${reports.length} versions)`);
  });
});

// --- Always-on: guard the matching logic against regressions ----------------

describe('score lib matching', () => {
  it('matches a short planted phrase by containment', () => {
    expect(overlaps('pastel branding', 'Strip away the pastel branding and the plan')).toBe(true);
  });
  it('matches a long planted sentence by token overlap even from a fragment', () => {
    const planted = 'they want to abolish the single-family neighborhood as a category and hand our streets over to corporate landlords';
    const engineQuote = 'they want to abolish the single-family neighborhood and hand streets to corporate landlords';
    expect(overlaps(planted, engineQuote, 0.5)).toBe(true);
  });
  it('does not match unrelated text', () => {
    expect(overlaps('developer-driven land grab', 'the county assessor filed a report on rents')).toBe(false);
  });
  it('normalises smart quotes and dashes', () => {
    expect(norm('“don’t—stop”')).toBe('"don\'t-stop"');
  });
  it('drops stopwords from token sets', () => {
    const t = tokens('the argument that they will fail');
    expect(t.has('argument')).toBe(true);
    expect(t.has('the')).toBe(false);
    expect(t.has('will')).toBe(false);
  });
});
