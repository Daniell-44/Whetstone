// Engine-eval harness — NOT part of the normal suite. Runs the real audit
// engine (live Gemini calls, full Phase-2) against the eval corpus and dumps
// raw outputs for scoring. Bypasses HTTP/rate-limits/sessions by calling
// auditText directly with the .dev.vars key.
//
//   RUN_EVAL=1 pnpm exec vitest run tests/eval-harness.test.ts
//   RUN_EVAL=1 EVAL_ONLY=<id> ...      run a single corpus item
//   RUN_EVAL=1 EVAL_REPEATS=3 ...      repeat runs (consistency measurement)
//   RUN_EVAL=1 EVAL_FEWSHOT=1 ...      ship the fallacy definitions + worked
//                                      examples with the prompt (see ENGINE_FIXES
//                                      "fix zero" — production sends bare names)
//   RUN_EVAL=1 EVAL_OUT=outputs-e7 ... write somewhere other than eval/outputs,
//                                      so a variant run does not overwrite the
//                                      baseline you are comparing it against
//
// Corpus:  eval/corpus/*.json  ({ id, category, targetLenses, text, answerKey })
// Output:  eval/outputs/<id>.run<N>.json

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditText } from '../functions/_lib/audit/engine';
import { GeminiProvider } from '../functions/_lib/providers/gemini';

const ROOT       = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS_DIR = join(ROOT, 'eval', 'corpus');
// A variant run MUST be able to write elsewhere: without this the only way to
// try a prompt change was to destroy the snapshot you wanted to compare to.
const OUT_DIR    = join(ROOT, 'eval', process.env.EVAL_OUT || 'outputs');

function readDevVar(name: string): string | undefined {
  try {
    const raw = readFileSync(join(ROOT, '.dev.vars'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
      if (m && m[1] === name) return m[2];
    }
  } catch { /* no .dev.vars */ }
  return undefined;
}

interface CorpusItem {
  id:           string;
  category:     string;
  targetLenses: string[];
  text:         string;
  answerKey:    unknown;
}

describe.runIf(process.env.RUN_EVAL === '1')('audit engine eval harness', () => {
  const apiKey = readDevVar('GEMINI_API_KEY');
  const only    = process.env.EVAL_ONLY;
  const repeats = parseInt(process.env.EVAL_REPEATS ?? '1', 10);

  const files = readdirSync(CORPUS_DIR).filter(f => f.endsWith('.json'));
  const items: CorpusItem[] = files
    .map(f => JSON.parse(readFileSync(join(CORPUS_DIR, f), 'utf8')) as CorpusItem)
    .filter(i => !only || i.id === only);

  it('has a key and a corpus', () => {
    expect(apiKey, 'GEMINI_API_KEY missing from .dev.vars').toBeTruthy();
    expect(items.length, 'no corpus items found').toBeGreaterThan(0);
  });

  for (const item of items) {
    for (let run = 1; run <= repeats; run++) {
      it(`audits ${item.id} (run ${run})`, { timeout: 120_000 }, async () => {
        const provider = new GeminiProvider();
        const started  = Date.now();
        const result   = await auditText(item.text, {
          provider,
          apiKey: apiKey!,
          includePhase2: true,
          // Off in production: the model is handed 26 bare fallacy names with
          // no definition and no example. Setting EVAL_FEWSHOT=1 ships them,
          // which is the comparison recorded as "fix zero" in ENGINE_FIXES.md.
          ...(process.env.EVAL_FEWSHOT === '1' ? { promptVariant: { fewShot: true } } : {}),
        });
        const latencyMs = Date.now() - started;

        mkdirSync(OUT_DIR, { recursive: true });
        writeFileSync(
          join(OUT_DIR, `${item.id}.run${run}.json`),
          JSON.stringify({ id: item.id, run, latencyMs, result }, null, 2),
        );

        expect(result.audit.centralClaim).toBeTruthy();
      });
    }
  }
});
