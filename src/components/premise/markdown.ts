/**
 * A mini-briefing as markdown, for pasting anywhere.
 *
 * Pure and separate from the component so it can be tested without a renderer,
 * because this is the last place text is formatted before it leaves the site
 * and stops carrying any of the page's framing with it.
 *
 * House copy rules hold in the export too: no em dashes, stances written as
 * words, and the verification promise stated plainly at the end. Quotation
 * marks appear only around passages that survived the character-exact check.
 */
import type { ClientMiniBriefing, MiniSource } from '../../../functions/_lib/premise/mini';
import { STANCE_LABEL } from './MiniBriefingBody';

function sourceLine(s: MiniSource): string {
  const stance = STANCE_LABEL[s.stance ?? 'supports'];
  const who = [s.who, s.publication].filter(Boolean).join(', ');
  const url = s.resolvedUrl ?? s.url;
  // Quotation marks only for a verified quote. `position` is our paraphrase
  // and gets none, which is the same rule the rendered page follows.
  const body = s.quote ? `"${s.quote}"` : s.position;
  return `- ${stance}. ${who}: ${body}${url ? ` (${url})` : ''}`;
}

export function briefingToMarkdown(b: ClientMiniBriefing, sourceUrl?: string): string {
  const lines: string[] = [];
  lines.push(`# ${b.question || 'Mini-briefing'}`);
  lines.push('');
  if (b.conclusion) {
    lines.push(`What the answer turns on: ${b.conclusion}`);
    lines.push('');
  }

  b.premises.forEach((p, i) => {
    lines.push(`## Claim ${i + 1}: ${p.claim}`);
    lines.push('');
    if (p.load) {
      lines.push(`Why it carries weight: ${p.load}`);
      lines.push('');
    }
    for (const s of p.sources) {
      lines.push(sourceLine(s));
      lines.push('');
    }
    if (p.undisputed) {
      lines.push('No published objection was found for this claim. That is not agreement; it may only mean nobody has written the objection down where this run could reach.');
      lines.push('');
    }
  });

  if (b.opposing.length > 0) {
    lines.push('## Published disagreement');
    lines.push('');
    for (const s of b.opposing) {
      lines.push(sourceLine(s));
      lines.push('');
    }
  }

  if (b.limits.length > 0) {
    lines.push('## What this cannot promise');
    lines.push('');
    for (const l of b.limits) lines.push(`- ${l}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    `Built with The Whetstone (${sourceUrl ?? 'https://thewhetstone.review/creator/studio/cross-document'}). ` +
    'Every quote above was checked word-for-word against its source page before it was shown; ' +
    'quotes that failed the check were dropped, not softened. This is machine-made and has not been edited by a person.',
  );
  return lines.join('\n');
}
