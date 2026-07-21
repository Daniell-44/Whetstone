# Nuclear costings piece set — drafts for your edit (2026-07-21)

Three drafts, one source bank, one validator. **Nothing here publishes**: the site only reads
`src/content/briefings/*.md`, and this folder is outside it. The `draft: true` front-matter line is
informational only — the parser ignores unknown keys, so the folder location is the real safety.

## The set (the sub-article model, first outing)

1. `gencost-review.md` — CSIRO GenCost audited as an argument. Its own contested ground
   (axis: stacked-against vs generous-to nuclear), five plotted positions, quote-anchored.
2. `frontier-review.md` — the Frontier Economics costings audited the same way.
3. `nuclear-costings-parent.md` — the lines-of-argumentation map: the five method choices the whole
   fight decomposes into (what to measure, which demand future, capacity factor, asset life, timing),
   who stands where on each, what would settle each. Links down to the two reviews.
4. `nuclear-source-banks.json` — 135 URL-anchored claims/quotes from the research pass. Your quarry
   for edits: every quote in the drafts is in here with its URL and locator.

## Your pass, in order

1. Read each draft; resolve every `[OWNER: ...]` marker (verdicts, slug names, two quote
   reconciliations flagged inline).
2. Rename to your chosen slugs; set the parent's links to the review slugs.
3. Move into `src/content/briefings/` (publish order suggestion: reviews first, parent last so its
   links resolve).
4. Run the gate per file: `pnpm verify:quotes <slug>` — HTML-sourced quotes went through an
   extraction layer and MUST pass this before shipping; the CSIRO accessible-text and PDF quotes were
   verified in-session (two spot-checked character-for-character again today) but gate them anyway.
5. `pnpm exec tsx drafts/check-drafts.ts` re-validates format after your edits (all three currently
   parse clean, zero warnings).
6. Delete this folder in the publishing commit.

## Honesty notes

- Current-state facts (election, Taylor leadership, ban status, NSW bill) were live-verified to
  2026-07-21 and are dated in-text. The 2025-26 GenCost FINAL (15 July 2026) is the current edition
  and the drafts cite it — check nothing newer landed before you publish.
- The audits deliberately include "The Inference Holds" verdicts where no fallacy exists. Do not let
  editing pressure turn those into invented findings; they are the factual register's spine.
- Wood's "54-89" vs the report's "53-89" and the CEC's "/kWh" typo are flagged inline — verbatim
  fidelity beats tidiness, but both need a sic-or-footnote decision.
