// ---------------------------------------------------------------------------
// Grounded attribution — eval runner.
//
// Runs each fixture through its corresponding engine, compares the engine's
// emitted `groundedness.kind` distribution against the human-labelled
// expected distribution, reports per-fixture and aggregate agreement.
//
// Usage:
//   npx tsx evals/grounded/runner.ts
//
// Env requirements:
//   GEMINI_API_KEY     — for any LLM-backed engine call
//
// Citation-audit fixtures will run with a no-op extractor (won't actually
// fetch citations) — for now we measure kind labelling, not citation
// verdict accuracy. Verifying citation-fetching separately is out of scope
// for this harness.
// ---------------------------------------------------------------------------

import { FIXTURES } from './fixtures';
import type { Fixture, FixtureResult, EvalSummary, EngineName } from './types';
import type { GroundednessKind, GroundednessSignal } from '../../functions/_lib/grounded/types';

import { GeminiProvider } from '../../functions/_lib/providers/gemini';
import { auditText }      from '../../functions/_lib/audit/engine';
import { extractArgument } from '../../functions/_lib/argument-extraction/engine';
import { detectCommitments } from '../../functions/_lib/philosophical-commitments/engine';
// citation-audit deferred from harness — see comment above

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Set GEMINI_API_KEY before running.');
  process.exit(1);
}

const provider = new GeminiProvider();

// ---------------------------------------------------------------------------
// Run a single fixture through its engine, collect actual GroundednessSignals.
// ---------------------------------------------------------------------------

async function runFixture(f: Fixture): Promise<GroundednessSignal[]> {
  switch (f.engine) {
    case 'audit': {
      const { audit } = await auditText(f.text, { provider, apiKey: apiKey! });
      return [
        ...audit.namedFallacies.map(x => x.groundedness),
        ...audit.loadedLanguage.map(x => x.groundedness),
        ...audit.toulmin.unstatedWarrants.map(x => x.groundedness),
        ...(audit.keyTermScrutiny      ?? []).map(x => x.groundedness),
        ...(audit.referentChecks       ?? []).map(x => x.groundedness),
        ...(audit.falsifiabilityChecks ?? []).map(x => x.groundedness),
        ...(audit.modalScopeChecks     ?? []).map(x => x.groundedness),
      ];
    }
    case 'extraction': {
      const { result } = await extractArgument(f.text, { provider, apiKey: apiKey! });
      // Extraction emits one groundedness per result, plus statements that
      // would inherit (we don't yet emit per-statement groundedness).
      return [result.groundedness];
    }
    case 'commitments': {
      const { result } = await detectCommitments(f.text, { provider, apiKey: apiKey! });
      const out: GroundednessSignal[] = [];
      if (result.ethical)        out.push(result.ethical.groundedness);
      if (result.epistemic)      out.push(result.epistemic.groundedness);
      if (result.political)      out.push(result.political.groundedness);
      if (result.methodological) out.push(result.methodological.groundedness);
      return out;
    }
    case 'citation': {
      // Deferred: would need a citation-fetcher. Mark as skipped.
      throw new Error('citation engine eval is not yet wired into the harness');
    }
  }
}

// ---------------------------------------------------------------------------
// Compare expected vs actual distributions of GroundednessKind.
//
// Tolerance rule: a fixture "agrees" if for each kind present in expected
// or actual, the counts differ by ≤1. This handles minor LLM variability
// (an extra finding here or there) without inflating agreement falsely.
// ---------------------------------------------------------------------------

function emptyKindCounts(): Record<GroundednessKind, number> {
  return { structural: 0, interpretive: 0, empirical: 0 };
}

function tally(signals: { kind: GroundednessKind }[]): Record<GroundednessKind, number> {
  const counts = emptyKindCounts();
  for (const s of signals) counts[s.kind]++;
  return counts;
}

function distributionsAgree(
  expected: Record<GroundednessKind, number>,
  actual:   Record<GroundednessKind, number>,
): boolean {
  for (const k of Object.keys(expected) as GroundednessKind[]) {
    if (Math.abs(expected[k] - actual[k]) > 1) return false;
  }
  return true;
}

function diagnosticString(
  expected: Record<GroundednessKind, number>,
  actual:   Record<GroundednessKind, number>,
): string {
  return `expected={s:${expected.structural} i:${expected.interpretive} e:${expected.empirical}} actual={s:${actual.structural} i:${actual.interpretive} e:${actual.empirical}}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Running ${FIXTURES.length} fixtures...\n`);
  const results: FixtureResult[] = [];

  for (const f of FIXTURES) {
    process.stdout.write(`  [${f.id}] (${f.engine}) ... `);
    try {
      const actualSignals = await runFixture(f);
      const expectedCounts = tally(f.expected);
      const actualCounts   = tally(actualSignals);
      const agreed = distributionsAgree(expectedCounts, actualCounts);
      const diagnostic = diagnosticString(expectedCounts, actualCounts);
      results.push({ fixtureId: f.id, engine: f.engine, expectedKindCounts: expectedCounts, actualKindCounts: actualCounts, agreed, diagnostic });
      process.stdout.write(agreed ? '✓\n' : `✗  ${diagnostic}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`SKIPPED: ${msg}\n`);
    }
  }

  // ---- Aggregate
  const byEngine: Record<EngineName, { total: number; agreed: number }> = {
    audit:       { total: 0, agreed: 0 },
    extraction:  { total: 0, agreed: 0 },
    commitments: { total: 0, agreed: 0 },
    citation:    { total: 0, agreed: 0 },
  };
  for (const r of results) {
    byEngine[r.engine].total++;
    if (r.agreed) byEngine[r.engine].agreed++;
  }
  const totalFixtures  = results.length;
  const agreedFixtures = results.filter(r => r.agreed).length;
  const failing        = results.filter(r => !r.agreed);

  const summary: EvalSummary = {
    totalFixtures,
    agreedFixtures,
    agreementPercent: totalFixtures > 0 ? Math.round((agreedFixtures / totalFixtures) * 100) : 0,
    byEngine,
    failingFixtures: failing,
  };

  console.log('\n=== Summary ===');
  console.log(`Total agreement: ${summary.agreedFixtures}/${summary.totalFixtures} (${summary.agreementPercent}%)`);
  console.log(`Gate: ≥85% — ${summary.agreementPercent >= 85 ? 'PASS' : 'FAIL'}`);
  console.log('\nPer-engine:');
  for (const [engine, stats] of Object.entries(summary.byEngine)) {
    if (stats.total === 0) continue;
    const pct = Math.round((stats.agreed / stats.total) * 100);
    console.log(`  ${engine.padEnd(12)} ${stats.agreed}/${stats.total} (${pct}%)`);
  }
  if (failing.length > 0) {
    console.log(`\nFailing fixtures (${failing.length}):`);
    for (const r of failing) {
      console.log(`  - ${r.fixtureId} (${r.engine}): ${r.diagnostic}`);
    }
  }
}

main().catch((err) => {
  console.error('Eval run failed:', err);
  process.exit(1);
});
