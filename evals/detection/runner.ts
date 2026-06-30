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
import { AnthropicProvider } from '../../functions/_lib/providers/anthropic';
import { auditText } from '../../functions/_lib/audit/engine';

// Provider switch: EVAL_PROVIDER=gemini (default) | claude. Claude is the
// fallback when Gemini is rate-limited — note it tests a DIFFERENT model than
// production (gemini-2.5-flash), so label any Claude-run results as such.
const useClaude  = ['claude', 'anthropic'].includes((process.env.EVAL_PROVIDER ?? 'gemini').toLowerCase());
const provider   = useClaude ? new AnthropicProvider() : new GeminiProvider();
const apiKey     = useClaude ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
const evalModel  = useClaude ? (process.env.EVAL_MODEL ?? 'claude-haiku-4-5-20251001') : undefined; // undefined → AUDIT_MODEL
if (!apiKey) {
  console.error(`Set ${useClaude ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} before running.`);
  process.exit(1);
}

// Pacing between fixtures (ms) — long multi-round runs otherwise hit sustained
// provider rate-limits that skip everything. 0 = no delay (default).
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  console.log(`Running ${DETECTION_FIXTURES.length} detection fixtures  [variant: ${ENV}] [provider: ${provider.name}${evalModel ? '/' + evalModel : ''}]${DELAY_MS ? ` [delay ${DELAY_MS}ms]` : ''}\n`);
  let TP = 0;
  let FP = 0;
  let FN = 0;
  let skipped = 0;
  const calSamples: Array<{ confidence: number; correct: boolean }> = [];

  for (const f of DETECTION_FIXTURES) {
    if (DELAY_MS) await sleep(DELAY_MS); // pace to avoid provider rate-limits
    // One fixture's audit failure (e.g. an intermittent schema-validation
    // error from the engine) must not abort the whole run - skip and continue
    // so the metrics still report over the fixtures that succeeded.
    let audit: Awaited<ReturnType<typeof auditText>>['audit'];
    try {
      ({ audit } = await auditText(f.text, { provider, apiKey: apiKey!, promptVariant, model: evalModel }));
    } catch (err) {
      skipped++;
      console.log(`  [${f.id}] SKIPPED — audit error: ${(err as Error).message.split('\n')[0]}`);
      continue;
    }
    const actualNames = audit.namedFallacies.map((x) => x.name);
    const m = matchFindings(f.expectedFallacies, actualNames, f.acceptableAlternatives ?? []);
    TP += m.tp; FP += m.fp; FN += m.fn;

    // Calibration credits expected + acceptable-alternate labels as "correct".
    const okSet = new Set([...f.expectedFallacies, ...(f.acceptableAlternatives ?? [])].map((s) => s.toLowerCase()));
    for (const nf of audit.namedFallacies) {
      calSamples.push({ confidence: nf._debugConfidence ?? 50, correct: okSet.has(nf.name.toLowerCase()) });
    }

    const tag = m.fp > 0 ? `OVER-DETECT +[${m.spurious.join(', ')}]`
              : m.fn > 0 ? `MISS -[${m.missed.join(', ')}]`
              : 'ok';
    console.log(`  [${f.id}] expected[${f.expectedFallacies.join(', ') || '—'}] got[${actualNames.join(', ') || '—'}] ${tag}`);
  }

  const overall = prf(TP, FP, FN);
  const cal = calibration(calSamples);

  console.log('\n=== Detection summary ===');
  console.log(`TP=${TP}  FP=${FP}  FN=${FN}${skipped ? `  skipped=${skipped}` : ''}`);
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
