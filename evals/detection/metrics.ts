// Detection-eval metrics (pure, no network).
//
// The grounded harness (evals/grounded) measures whether the engine labels a
// finding's *kind* correctly. It does NOT measure whether the engine flags the
// *right fallacies* — and over-detection (false positives) is the documented
// #1 failure mode for LLM fallacy detection. This module supplies the metric
// layer for a finding-level eval: precision / recall / F1 against expected
// fallacy names, plus a calibration (ECE) check on the hidden confidence score.
//
// Kept pure so it's unit-testable without spending LLM quota; the runner
// (runner.ts) wires it to the live engine.

export interface FindingMatch {
  tp: number;          // emitted fallacies that were expected
  fp: number;          // emitted but not expected (over-detection)
  fn: number;          // expected but not emitted (misses)
  spurious: string[];  // the false-positive names
  missed:   string[];  // the false-negative (expected) names
}

const norm = (s: string): string => s.trim().toLowerCase();

/**
 * Multiset name-match of emitted vs expected fallacy names (case-insensitive).
 * `alternatives` are defensible second labels for a fixture: if the engine emits
 * one, it is neither credited as a true positive (it wasn't required) nor
 * penalised as a false positive (it isn't wrong). This stops the single-label
 * matcher from under-crediting the engine on genuine label-boundary cases
 * (e.g. a passage that is both Appeal to Authority and Cherry-Picking).
 */
export function matchFindings(expected: string[], actual: string[], alternatives: string[] = []): FindingMatch {
  const remaining = expected.map(norm); // shrinks as emitted names are matched
  const alts = new Set(alternatives.map(norm));
  const spurious: string[] = [];
  let tp = 0;
  for (const a of actual) {
    const i = remaining.indexOf(norm(a));
    if (i >= 0) { tp += 1; remaining.splice(i, 1); }
    else if (alts.has(norm(a))) { /* defensible alternate — ignore, neither credit nor penalise */ }
    else spurious.push(a);
  }
  // Whatever's left in `remaining` was expected but never matched = the misses.
  return { tp, fp: spurious.length, fn: remaining.length, spurious, missed: remaining };
}

export interface PRF { precision: number; recall: number; f1: number; }

/**
 * Precision/recall/F1. Conventions for the empty cases that matter for
 * adversarial zero-finding fixtures:
 *   - no findings emitted at all (tp+fp=0): precision = 1 (nothing wrong said)
 *   - nothing expected (tp+fn=0):           recall = 1 (nothing to miss)
 * So a clean passage the engine leaves alone scores F1 = 1; one false finding
 * on it scores precision 0, F1 0 — exactly the over-detection penalty we want.
 */
export function prf(tp: number, fp: number, fn: number): PRF {
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall    = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1        = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

export interface CalibrationBucket {
  range:          string;
  n:              number;
  meanConfidence: number; // 0–1
  accuracy:       number; // 0–1
  gap:            number; // |meanConfidence − accuracy|
}
export interface Calibration { buckets: CalibrationBucket[]; ece: number; }

/**
 * Expected Calibration Error over confidence buckets. `confidence` is the
 * engine's 0–100 score (now the hidden `_debugConfidence`); `correct` is
 * whether that finding was a true positive. ECE > ~0.15 flags overconfidence.
 */
export function calibration(
  samples: Array<{ confidence: number; correct: boolean }>,
  bucketCount = 4,
): Calibration {
  const total = samples.length;
  const size = 100 / bucketCount;
  const buckets: CalibrationBucket[] = [];
  let ece = 0;
  for (let i = 0; i < bucketCount; i++) {
    const lo = i * size;
    const hi = (i + 1) * size;
    const inB = samples.filter((s) =>
      i === 0 ? s.confidence >= lo && s.confidence <= hi : s.confidence > lo && s.confidence <= hi,
    );
    const n = inB.length;
    const meanConfidence = n ? inB.reduce((a, s) => a + s.confidence, 0) / n / 100 : 0;
    const accuracy = n ? inB.filter((s) => s.correct).length / n : 0;
    const gap = Math.abs(meanConfidence - accuracy);
    if (n) ece += (n / total) * gap;
    buckets.push({ range: `${lo}-${hi}`, n, meanConfidence, accuracy, gap });
  }
  return { buckets, ece: total ? ece : 0 };
}
