# Frontier diffs — production engine vs a gold-standard frontier audit

> Generated 2026-07-09 by the `frontier-diffs` workflow (`wf_12edae20-de1`). Method: for each item, a **blind frontier audit** (Claude Opus 4.8, high effort, raw text only, the engine's 7-lens taxonomy) → a **diff** against the committed production output in `eval/outputs/<id>.run1.json` → one **synthesis memo**. No Gemini spend (engine outputs already existed); Claude tokens only (~321k, 9 agents).
>
> This is the *calibration + marketing* read the scorecard's aggregate metrics can't give: on real, uncontrolled prose, **where does the production engine (Gemini Flash) fall short of a frontier model, and where does it hold?** The 4 items are the residue the 2026-07-07 assessment left open (`real-oped-1/2/3` + `unfalsifiable-mottebailey`). Grounded in the raw diffs below — treat the frontier audit as a strong-but-fallible gold standard, not ground truth.

## Bottom line

| Item | Detection | Integration |
|---|---|---|
| real-oped-1 (Reason/Volokh, Cook reinstatement) | 4 | 3 |
| real-oped-2 (opposite side, Fed-is-special) | 3 | 2 |
| real-oped-3 (NZ climate tort litigation) | 3 | 2 |
| unfalsifiable-mottebailey (wellness essay) | 4.5 | 3 |
| **Mean** | **3.6** | **2.5** |

**A consistent ~1.1-point detection-over-integration gap, in the same direction on all four items.** Detection never drops below 3 and reaches 4.5; integration never exceeds 3 and bottoms at 2. That uniformity means the weakness is **structural and repeatable** — a tractable prompt-engineering target, not a model-capability ceiling. The prior assessment's "the gap is integration/synthesis, not detection" is **confirmed and sharpened**: on the two legal op-eds the engine also *cleanly missed* whole defects within a lens it had running (the head-count fallacy, the need→entitlement warrant, the "cannot be lobbied" absolute modal). So the honest gap is **"characterisation + ranking + some in-lens recall," not "synthesis alone."**

---

## Synthesis memo

### Headline

On four real, hard arguments (three published legal op-eds plus one motte-and-bailey wellness essay), the production engine is close to the frontier on *detection* and clearly behind on *integration* — and this data **confirms** the prior assessment, with one important sharpening. The engine independently surfaced every high-severity defect category the gold-standard audit did on three of the four items, and added well-evidenced findings the frontier under-called on all four (the "guilty of mortgage fraud" equivocation, the "that was not true" certainty overreach, the reification of "Wall Street and global markets", the "abundance" equivocation). Its consistent weakness is not *finding* the defective spans but *characterising and ranking* them: it repeatedly spends its scarce high-value slots (namedFallacy, modalScope, keyTerm) on the decorative instance of a defect while the load-bearing instance goes unnamed, and it files findings as a flat span-by-span list instead of naming the single move the whole argument rests on. The sharpening the data forces: on **real-oped-2 and real-oped-3 the gap is not purely synthesis** — the engine cleanly *missed* whole defects (the head-count/false-consensus fallacy, the need-implies-entitlement warrant, the insulation equivocation on oped-2; the "cannot be lobbied" absolute modal and the twin vague referents on oped-3), several within a lens it had actively running and with budget to spare. So the honest gap is "characterisation + ranking + some in-lens recall," not "synthesis alone."

### Systematic misses (prompt-improvement targets, most actionable first)

1. **The engine routes fallacies/modality to the obvious span, not the load-bearing one.** The single most repeated pattern.
   - oped-1: namedFallacy aimed at "character flaw" (decorative aside) instead of the motive-substitution that is the argument's spine; the frontier put the ad hominem on the load-bearing conjecture.
   - oped-1: modalScope caught "that was not true" but missed "the one outcome that does not make sense" (the rhetorically decisive overreach).
   - oped-3: the false-continuum "Climate change is next in that sequence" — the engine *found the exact sentence* but filed it as a mere modal overstatement (medium) rather than the slippery-slope-by-analogy fallacy (high) the frontier named. The most important single divergence in the set.
   - **Fix direction:** when multiple spans trip the same lens, force a ranking step that asks "which instance carries the conclusion?" and prefer naming that one. Reward correct *severity* on spine-level moves.

2. **Under-served lens: `falsifiabilityChecks` frequently returns empty where the frontier finds an untestable structure.** Empty on oped-2 (the double-hedged "something like a consensus"), oped-3 (the cost-conservation "law"), and a partial miss on the motte-bailey. When the engine *did* touch these spans, it filed them as loadedLanguage/weasel-words or Straw Man — a *different* critique from "no observation could count as disconfirmation." **Fix:** prompt the falsifiability lens to explicitly test "what result would the author accept as refuting this?" rather than keying off vague wording.

3. **`keyTermScrutiny` spends its slot and stops.** The engine repeatedly lands one good equivocation and misses a second, more central one: oped-1 caught "guilty of mortgage fraud" but missed "the law"/"rule of law"/"illegally" (the actual hinge); oped-2 spent it on "consensus" and missed the "insulated from outside political forces" equivocation. **Fix:** allow/encourage multiple key-term findings and prompt it to check the argument's *title-level* term specifically.

4. **No head-count / argument-from-consensus fallacy in the vocabulary (or not firing).** oped-2's designated weakest link — an 8-1 count on a narrow question recast as endorsement of a broad thesis — was diffused across three medium findings and never named. Check the named-fallacy inventory covers appeal-to-consensus explicitly.

5. **Unstated-warrant recall misses the need→entitlement / value→legal-right bridge.** Both legal op-eds (oped-2 explicitly HIGH) turn on a silent move from "X is functionally valuable" to "X is legally/constitutionally owed," and the engine's warrant findings landed adjacent premises instead. **Fix:** prompt the warrant lens to look specifically for is/ought and functional→normative bridges.

6. **One over-reach to watch: Straw Man invention.** oped-3's Straw Man finding asserted what the government "likely" argues without the text supplying that position — the engine partly *invented the misrepresented original* to name the fallacy. Given fabrication is the cardinal sin here, tighten the Straw Man lens to require the misrepresented position be quotable from the text.

7. **Minor target-attribution slip.** oped-2 attributed a fallacy to the author on a span that was a *quote of the court's opinion*. The modal observation was sound but the attribution was wrong. Worth a guard that checks whether a flagged span is the author's assertion or a quotation.

### Where the engine holds (marketing-safe, each checkable in the JSON)

- **Span-level detection is strong and often *exceeds* the frontier's recall.** On every one of the four items the engine produced at least one well-evidenced finding the frontier omitted or under-called: the "guilty of mortgage fraud" two-quote equivocation and the "that was not true" certainty overreach (oped-1); the "Wall Street and global markets" reification (oped-2); the standalone "lax climate policy" loaded term and the "uncertainty" pivot (oped-3); the "abundance" equivocation and the anecdote-to-universal-law warrant (motte-bailey).
- **On high-severity defects it matches the gold standard.** On the motte-and-bailey piece it hit every high-severity defect the frontier did (motte-and-bailey at high, unfalsifiability mechanism nailed at _debugConfidence 98, no-true-Scotsman, energy equivocation, confirmation-asymmetry warrant) and added one the frontier missed.
- **It reliably catches loaded/emotive language** ("unelected/life-tenured", "Democrat-appointed", "sullies the reputation", "lax") — recall on charged phrasing consistently met or beat the frontier.
- **Multi-lens coverage of a defect region is a genuine strength**, even when it's also the weakness: on oped-2's consensus close and oped-1's evenhandedness framing it correctly *swarmed* the right region from three or four angles. The right spans were flagged; the failure was naming, not finding.

### Marketing-safe claims (survive a skeptic reading the raw JSON)

1. "On real published op-eds, the engine independently surfaced every major defect *category* the gold-standard frontier audit found, and on all four test pieces it added at least one well-evidenced finding the frontier under-called." — Supported: true category-level coverage on oped-1 and the motte-bailey; independent adds on all four. *Internal caveat:* on oped-2/oped-3 it missed specific defects (head-count fallacy, need→entitlement warrant), so say "defect category" — not "every defect."
2. "On a hard unfalsifiability/motte-and-bailey argument, the engine matched the gold-standard audit on every high-severity defect and caught one the reference audit missed." — Directly supported (motte-bailey detection 4.5).
3. "The engine's span-level recall on charged language and equivocation frequently exceeds the frontier's — it isolates term-level defects the frontier folds away." — Supported by the "guilty of mortgage fraud", "uncertainty", and "abundance" catches.

**Claims to NOT make:** "matches the frontier's *diagnosis*" or "identifies the argument's core weakness." The data contradicts this — in 3 of 4 items the frontier's weakest-link diagnosis was sharper (admitted conjecture on oped-1, head-count on oped-2, the disanalogy on oped-3), and the engine named the region without naming the move.

### What this means for the queue

Integration scores are depressed partly by *detection* misses on the two legal op-eds (a head-count fallacy you never detect can't be integrated), so improving named-fallacy/warrant recall (misses #4, #5) will lift the integration number even before any dedicated synthesis step. **The highest-leverage single change is the ranking/naming pass (miss #1):** the spans are already being found; teaching the engine to point its named-fallacy and severity budget at the load-bearing instance would close most of the visible gap with the frontier. All seven are prompt-level and need a live harness re-run (`RUN_EVAL=1 … → eval/outputs-e7/`, then `pnpm eval:score`) to measure — Daniel's cost lane.

---

## Appendix — per-item diffs (condensed)

Full structured diffs (every miss, win, disagreement with adjudication) are in the workflow output; the load-bearing points per item:

**real-oped-1** (det 4 / int 3) — Gap: aims scarce high-value slots at secondary spans while load-bearing versions go unnamed; misses that the whole indictment collapses into one admitted conjecture. Sharpest miss: named the ad hominem on the decorative "character flaw" aside rather than the motive-substitution that *is* the argument's spine. Wins: cleanly separated the "guilty of mortgage fraud" executive-vs-judicial equivocation (frontier folded it away) and the "that was not true" certainty overreach.

**real-oped-2** (det 3 / int 2) — Gap: swarmed the consensus region correctly but never *named* the head-count / false-consensus fallacy (diffused across three medium findings), left the essay's central need→legal-entitlement warrant uncaught, and missed the "insulated from political forces" equivocation. Win: the "Wall Street and global markets" reification the frontier omitted. Watch: attributed a fallacy to a span that was a quote of the court, not the author.

**real-oped-3** (det 3 / int 2) — Gap: located the exact load-bearing sentence ("Climate change is next in that sequence") but under-diagnosed it as a modal overstatement (medium) rather than the slippery-slope-by-analogy fallacy (high); never assembled the frontier's single thesis (the whole case rests on an unaddressed climate/precedent disanalogy). Over-reach: a speculative Straw Man that partly invented the government's position — a fabrication-risk flag.

**unfalsifiable-mottebailey** (det 4.5 / int 3) — Gap: finds nearly every defect (and a couple the frontier under-called) but lists them as parallel items where the frontier fuses them into one thesis — an unfalsifiable claim whose immunity is *sold as a virtue* and defended by a motte-and-bailey retreat. Matched every high-severity defect and added the "abundance" equivocation; missed only three low/medium items (begging-the-question circularity, two low-severity modal overreaches).
