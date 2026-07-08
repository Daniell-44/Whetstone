# Engine eval — how the audit engine is measured over time

This directory is the **regression + marketing instrument** for the audit engine. It answers two standing questions: *did this engine change help or hurt?* (improvement) and *what can we honestly claim the engine does?* (marketing). Both read from the same artifact: **[`SCORECARD.md`](./SCORECARD.md)**.

## The pieces

| Path | What it is |
|---|---|
| `corpus/*.json` | 15 hand-authored adversarial items + 1 smoke item. Each has a `text`, an `answerKey` (planted defects per lens), deliberately **baited non-flaws** (`traps`), and `expectClean`. Two are clean controls. Three are uncontrolled real op-eds (null key → graded for calibration only). |
| `blind/*.txt` | The same source texts, no answer key — for blind frontier audits. |
| `outputs*/` | Raw engine outputs, one dir per engine **version** (`outputs-baseline-20260707`, `outputs-e2`, `outputs-e3`, `outputs` = current). Produced by the harness. |
| `graded/<version>.json` | LLM-graded verdicts per item for a version (optional layer). |
| `reports/<version>.json` | Full machine metrics per version, written by the scorer. |
| `SCORECARD.md` | The human-readable trend + headline + failure clusters. **Auto-generated — do not hand-edit.** |
| `lib/score.ts` | Pure, deterministic scoring functions (no I/O). Unit-tested in `tests/eval-score.test.ts`. |

## The flow

```
1. HARNESS  (live Gemini — costs API, Daniel's to run)
   RUN_EVAL=1 pnpm exec vitest run tests/eval-harness.test.ts
   → writes eval/outputs/<id>.run<N>.json   (rename the dir to outputs-<label>/ to freeze a version)

2. SCORER   (deterministic, free, safe to run anytime)
   pnpm eval:score
   → reads corpus + every SNAPSHOTS dir → writes reports/*.json + SCORECARD.md

3. GRADER   (LLM judgment layer, optional — run the `grade-audit` workflow)
   one read-only agent per corpus item, strict-grader prompt, structured verdict
   → save the returned array to graded/<version>.json, then re-run `pnpm eval:score` to fold it in
```

## Adding a new engine version

1. Run the harness into `eval/outputs-<label>/`.
2. Add a row to `SNAPSHOTS` in `scripts/score-engine.ts`.
3. (Optional) grade it → `graded/<label>.json`.
4. `pnpm eval:score`. The scorecard gains a column; the trend shows the delta.

## What the numbers mean

- **Deterministic** metrics (FP, location recall, verbatim, groundedness mix, consistency, latency) are checkable by anyone holding the JSON — safe to publish.
- **Location recall** is *lens-agnostic*: a defect counts as caught if any finding quotes an overlapping span, wherever it was filed. `unstatedWarrants` recall is a weak proxy (abstract paraphrases + deliberate routing into fallacies) — read it via the grader.
- **Graded** metrics are a single skeptical LLM pass. The structural/interpretive boundary is itself contestable — treat the failure-clusters section as review candidates, not a defect count.
