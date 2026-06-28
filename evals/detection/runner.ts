// Detection eval — runs each fixture through the audit engine and reports
// finding-level precision / recall / F1 plus a calibration (ECE) check on the
// hidden confidence score. Complements the grounded harness (which measures
// kind-labelling, not whether the right fallacies were caught).
//
// Usage:
//   GEMINI_API_KEY=... npx tsx evals/detection/runner.ts
//
// The clean fixtures (expectedFallacies: []) are the important ones: they
// measure over-detection. A high FP count there means the engine is
// trigger-happy — the documented #1 failure mode.

import { DETECTION_FIXTURES } from './fixtures';
import { matchFindings, prf, calibration } from './metrics';
import { GeminiProvider } from '../../functions/_lib/providers/gemini';
import { auditText } from '../../functions/_lib/audit/engine';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Set GEMINI_API_KEY before running.');
  process.exit(1);
}

const provider = new GeminiProvider();

// A/B the prompt. PROMPT_VARIANT = a comma/plus list of flags, or a preset:
//   control | impartial | reasoning | soundness | criticalq | precision | all
//   precision = impartial + soundness + criticalq (the over-detection package)
//   e.g.  PROMPT_VARIANT=soundness,criticalq pnpm eval:detection
const ENV = (process.env.PROMPT_VARIANT ?? 'control').toLowerCase();
const tokens = ENV.split(/[,+\s]+/).filter(Boolean);
const has = (t: string) => tokens.includes(t) || tokens.includes('all');
const precision = tokens.includes('precision');
const promptVariant = {
  impartiality:      precision || has('impartial'),
  reasoningFirst:    has('reasoning'),
  soundnessGate:     precision || has('soundness'),
  criticalQuestions: precision || has('criticalq'),
};

async function main(): Promise<void> {
  console.log(`Running ${DETECTION_FIXTURES.length} detection fixtures  [variant: ${ENV}]\n`);
  let TP = 0;
  let FP = 0;
  let FN = 0;
  const calSamples: Array<{ confidence: number; correct: boolean }> = [];

  for (const f of DETECTION_FIXTURES) {
    const { audit } = await auditText(f.text, { provider, apiKey: apiKey!, promptVariant });
    const actualNames = audit.namedFallacies.map((x) => x.name);
    const m = matchFindings(f.expectedFallacies, actualNames);
    TP += m.tp; FP += m.fp; FN += m.fn;

    const expSet = new Set(f.expectedFallacies.map((s) => s.toLowerCase()));
    for (const nf of audit.namedFallacies) {
      calSamples.push({ confidence: nf._debugConfidence ?? 50, correct: expSet.has(nf.name.toLowerCase()) });
    }

    const tag = m.fp > 0 ? `OVER-DETECT +[${m.spurious.join(', ')}]`
              : m.fn > 0 ? `MISS -[${m.missed.join(', ')}]`
              : 'ok';
    console.log(`  [${f.id}] expected[${f.expectedFallacies.join(', ') || '—'}] got[${actualNames.join(', ') || '—'}] ${tag}`);
  }

  const overall = prf(TP, FP, FN);
  const cal = calibration(calSamples);

  console.log('\n=== Detection summary ===');
  console.log(`TP=${TP}  FP=${FP}  FN=${FN}`);
  console.log(`precision=${overall.precision.toFixed(2)}  recall=${overall.recall.toFixed(2)}  F1=${overall.f1.toFixed(2)}`);
  console.log(`calibration ECE=${cal.ece.toFixed(3)}${cal.ece > 0.15 ? '  (OVERCONFIDENT — >0.15)' : ''}`);
  for (const b of cal.buckets) {
    if (b.n) console.log(`  conf ${b.range}: n=${b.n} mean=${(b.meanConfidence * 100).toFixed(0)} acc=${(b.accuracy * 100).toFixed(0)} gap=${b.gap.toFixed(2)}`);
  }
}

main().catch((err) => {
  console.error('Detection eval failed:', err);
  process.exit(1);
});
