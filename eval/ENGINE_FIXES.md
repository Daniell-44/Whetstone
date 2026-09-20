# Engine fixes — parked, in plain English

**Status:** not started. Shelved in 2026-09 on cost grounds — see "Cost,
corrected" below, because that reasoning was based on an estimate of mine that
was wrong by two orders of magnitude. The harness now supports running a
variant without destroying the baseline; it did not when this was shelved.

**Where this came from:** `eval/FRONTIER_DIFFS.md`. Four real published opinion
pieces were analysed twice — once by the production engine, once by a much
larger and more expensive model doing the same job properly — and the two were
compared. `eval/SCORECARD.md` holds the numeric version of the same picture.

---

## The one-sentence summary

**The engine finds the right sentences but frequently picks the wrong one to
make a fuss about.**

It reliably notices the flawed passages. Where it falls short is deciding which
flaw is load-bearing. It will name a fallacy in a throwaway aside while the same
fallacy, in the sentence the entire argument depends on, goes unnamed.

That pattern held on all four test pieces, in the same direction every time.
Consistency like that is good news: it means this is a fixable instruction
problem, not the model running out of ability.

---

## How fixing anything here works

The engine works by being handed a long set of written instructions before it
reads a word of the text. Every fix below is a change to those instructions —
in `functions/_lib/audit/prompts.ts`. No new code, no new engine.

The catch is proving a change helped. A reworded instruction can fix one thing
and quietly break another, and the only way to know is to re-run the engine
across the whole test set and compare the before and after:

```bash
# 1. Run the corpus with the change, writing somewhere NEW so the current
#    baseline survives for comparison. Needs GEMINI_API_KEY in .dev.vars.
RUN_EVAL=1 EVAL_FEWSHOT=1 EVAL_OUT=outputs-e7 \
  pnpm exec vitest run tests/eval-harness.test.ts

# 2. Uncomment the e7 row in scripts/score-engine.ts, then:
pnpm eval:score                   # rewrites eval/SCORECARD.md with both columns
```

**Cost, corrected.** An earlier draft of this file said "tens of dollars per
full run". That was wrong by roughly two orders of magnitude, and it is
probably why this work got shelved.

The arithmetic, from this repo's own numbers: the engine runs on
`gemini-2.5-flash` (`audit/constants.ts`), the corpus is 15 items, and the
existing baseline is 19 runs (two items repeated three times for the
consistency measurement). `billing/limits.ts` records the observed cost as
"a core audit + extraction ≈ $0.01". Nineteen of those is about **twenty
cents**. Shipping the definitions adds ~2,200 input tokens per run, which does
not change the order of magnitude.

So a full comparison run is **well under a dollar** — budget a few dollars for
three or four attempts. The real cost of this work is your attention, not the
API bill.

**Change one thing at a time.** Two prompt edits in one run and you cannot tell
which one moved the numbers.

---

## Fix zero — the engine is working half-blind

**Found 2026-09. Not one of the seven below. Probably worth more than all of them.**

The production prompt hands the model the 26 fallacy names as **bare labels** and
nothing else:

```
- "Abductive Closure"
- "Gish Gallop"
- "Base-Rate Neglect"
```

No definition. No example. No test for when it applies. For roughly half the
list, the engine is relying on whatever the model happens to believe those
phrases mean — and "whatever the model happens to believe", asked twice, is
not the same answer twice. That is a strong candidate cause of both weak
numbers in the scorecard: exact fallacy naming at 31.8%, and run-to-run
consistency at 0.26.

**The material to fix it is already written, already tested, and one flag
away.** `functions/_lib/audit/examples.ts` holds a worked example, a one-line
reason and a reference for all 26 — `tests/audit/examples.test.ts` checks none
is missing. `taxonomy.ts` holds a definition for each. Both are assembled into
`FEW_SHOT_LIBRARY` in `prompts.ts` and then gated:

```ts
// prompts.ts
${FALLACY_NAMES.map(f => `- "${f}"`).join('\n')}   // names only — this is what ships
${opts?.fewShot ? FEW_SHOT_LIBRARY : ''}          // definitions + examples — gated

// engine.ts
fewShot: deps.promptVariant?.fewShot ?? false     // A/B-pending, off by default
```

The comment says "A/B-pending". The A/B was apparently never run.

**What it costs:** about 2,200 extra input tokens per audit (~8,700 characters).
Against the ~$0.01 an audit already costs, that is a rounding error.

**What to do:** the two commands at the top of this file. `EVAL_FEWSHOT=1`
ships the definitions; `EVAL_OUT=outputs-e7` keeps the current baseline intact
so the scorer can put both columns side by side.

**Why it might not work:** a longer prompt can dilute attention, and more
vocabulary can mean more false positives on clean controls — currently a
perfect 0. Watch clean-control FPs as closely as the naming numbers. This is a
hypothesis with unusually good odds, not a certainty.

---

## The two worth doing regardless of budget

These are not polish. They are the engine saying something untrue, which is the
one failure a tool built on "we only quote what's actually there" cannot afford.

### 1. It invented a position in order to criticise it

On one op-ed the engine accused the author of misrepresenting their opponent —
a Straw Man. But the opposing view it described **was not in the text**. The
engine supplied it so there was something to point at.

**The fix:** instruct the Straw Man check to name the misrepresented position
only when it can quote that position from the text. No quote, no finding.

**Why it matters most:** every other weakness here makes the engine less
useful. This one makes it wrong, in the specific way that would destroy trust
if a user noticed it first.

### 2. It blamed the author for someone else's words

On another piece the engine flagged a sentence that was **a direct quote from a
court ruling**. The criticism was sound. It was aimed at the wrong person.

**The fix:** before attributing a flaw, check whether the passage is the
author's own assertion or something they are quoting.

---

## The five that improve quality

Roughly in order of how much they'd move the needle.

### 3. Aim at the sentence the argument rests on

The big one, and the cause of the one-sentence summary above.

Real example: an op-ed argued a judge's ruling was politically motivated, and
separately made a passing dig about the judge's character. The engine named the
fallacy in the passing dig. The reference analysis named it in the
politically-motivated claim — because that is what the conclusion rests on.

**The fix:** when several passages trip the same check, add a ranking step that
asks "which of these is the conclusion actually standing on?" and name that
one. Reward getting the severity right on the central move, not on the
decorative one.

### 4. The "everyone agrees" fallacy isn't in the vocabulary

One piece counted up who agreed with it — an 8-to-1 tally on a narrow question
— and used that to carry a much broader claim. That is a recognised fallacy
(appeal to consensus, or head-count). The engine spread its concern across
three mild findings and never named it.

**The fix:** check whether the fallacy list covers appeal-to-consensus
explicitly, and add it if not.

### 5. The testability check goes quiet too often

The lens meant to catch unfalsifiable claims returns nothing on passages where
the reference analysis found plenty. When the engine does notice those
passages, it files them as vague wording instead — a different and weaker
criticism than "no possible observation could disprove this."

**The fix:** have the lens ask directly, "what result would the author accept
as proving this wrong?" rather than looking for hedging words.

### 6. The key-term check stops after one

It finds one equivocal term, reports it, and stops — repeatedly missing a
second, more central one. In one case it caught a minor term and missed the
term in the article's own title.

**The fix:** allow multiple findings from this lens, and prompt it to check the
argument's headline term specifically.

### 7. It misses the "valuable, therefore owed" move

Both legal pieces turned on a silent jump from "X is useful" to "X is legally
owed." The engine's hidden-assumption findings landed on nearby premises and
missed the jump itself.

**The fix:** prompt the hidden-assumption lens to look specifically for
is/ought jumps — a fact used to carry a moral or legal conclusion.

---

## What not to do

**Don't fix them all in one pass.** Individually measurable is the whole point;
a batch of seven changes gives you one number and no idea what caused it.

**Don't trust a single grading run.** The graded metrics in `SCORECARD.md` come
from one skeptical pass. Re-run before believing a new column.

**Don't chase the `unstatedWarrants` recall number.** It reads low by design —
the engine deliberately routes assumption-shaped flaws into the named fallacy
that already implies them. `SCORECARD.md` explains this under Method. A low
number there is not a regression.

---

## Before the paid work: find out where the inconsistency lives

`SCORECARD.md` reports run-to-run consistency as one number (0.26 at E4). That
number is computed over every lens flattened together, so it cannot tell apart
two faults that need completely different fixes:

- **Detection drift** — the engine flags *different passages* on each run. The
  text didn't change, so this is the serious one.
- **Routing drift** — it flags the *same passages* and files them under
  different lenses. Partly expected, since the one-finding-per-defect rule
  deliberately routes a defect into whichever lens best implies it.

The scorer now reports these separately, plus a per-lens breakdown naming the
least stable lens. Re-running it is **free** — it reads the raw outputs already
on disk and makes no model calls:

```bash
pnpm eval:score
```

Read the new lines under the headline consistency figure before spending
anything on the fixes below. If routing is the problem, most of these are
aimed at the wrong target.

---

## Suggested order

1. Fix #1 (invented position) and #2 (misattributed quote) — correctness, and
   both are narrow enough to change with confidence.
2. Fix #3 (aim at the load-bearing sentence) — the single biggest quality gain.
3. Re-measure. Fixes #4–#7 partly overlap with #3, and some may already look
   better once the ranking step exists.
