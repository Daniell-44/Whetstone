// pnpm new:briefing <slug> ["The contested question?"]
//
// Stamps a VALID v2 briefing skeleton at src/content/briefings/<slug>.md so a
// new briefing starts on the current format (::positions / ::evidence + the
// block markers) — you fill in content, not structure. This is the guard
// against a new briefing being born on the legacy ::sources model (the exact
// thing that left minimum-wage-jobs presenting differently from the rest).
//
// The output parses as-is (placeholder text, real structure), so the feed and
// the briefing page render immediately; fill the TODOs, then run
// `pnpm verify:quotes <slug>` once the quotes are real.

import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIEFINGS_DIR = join(HERE, '..', 'src', 'content', 'briefings');

const slug = process.argv[2];
const question = process.argv[3] ?? 'TODO: the contested question, phrased as a question?';

if (!slug) {
  console.error('Usage: pnpm new:briefing <slug> ["The contested question?"]');
  process.exit(1);
}
// Slugs are the URL (/briefing/<slug>) and the filename — enforce kebab-case.
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error(`Slug must be kebab-case (lowercase, hyphen-separated). Got: "${slug}"`);
  process.exit(1);
}

const path = join(BRIEFINGS_DIR, `${slug}.md`);
if (existsSync(path)) {
  console.error(`A briefing already exists at ${path} — pick a different slug.`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

// The skeleton. Two audited positions (the minimum a briefing needs), one
// evidence row, and every downstream block. `otherTakes: none` states the
// absence of a ::takes block (the validator nags when it's unstated); delete
// that line and add a ::takes block if you survey other takes. The placeholder
// quotes appear verbatim inside their position paragraphs so the structure is
// self-consistent from the start.
const template = `---
question: ${question}
category: TODO
axisLeft: TODO left pole
axisRight: TODO right pole
publishedDate: ${today}
otherTakes: none
---

::positions
src1 | TODO Source One | Publication | https://example.com/one | -1 | med
src2 | TODO Source Two | Publication | https://example.com/two |  1 | med

::evidence
ev1 | TODO Supporting source | Publication | https://example.com/ev | What it contributes to the picture; note if it is not quoted or audited here.

::landscape
TODO: one or two sentences framing the contested question and the crux both sides actually turn on.

::position colour=0 source=src1 label="TODO left stance label" quote="TODO verbatim quote from source one"
TODO: the position paragraph. Run the verbatim quote — "TODO verbatim quote from source one" — into the prose, then say how the position reads it.
::audit name="TODO Fallacy" kind=structural
TODO: the structural audit of this position — the named flaw, in one or two sentences.

TODO: an optional one-line bridge into the opposing position.

::position colour=1 source=src2 label="TODO right stance label" quote="TODO verbatim quote from source two"
TODO: the opposing position paragraph, running its verbatim quote — "TODO verbatim quote from source two" — into the prose.
::audit name="TODO Fallacy" kind=structural
TODO: the structural audit of this position.

::shared
TODO: the assumption both sides stand on — the thing neither is questioning.

::editor
TODO: the editor's view — where you would bet, held loosely.
::why-wrong
TODO: why the editor's view might be wrong.
`;

writeFileSync(path, template, 'utf8');
console.log(`Created ${path}`);
console.log(`Next: fill the TODOs (kind can be structural | interpretive | empirical), then:`);
console.log(`  pnpm verify:quotes ${slug}   # once the quotes are real`);
console.log(`  add "${slug}" to src/data/featured.ts to feature it on the home page`);
