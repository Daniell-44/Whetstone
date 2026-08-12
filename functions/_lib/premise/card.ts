import { z } from 'zod';
import type { LlmProvider } from '../providers/types';

/**
 * THE PREMISE CARD.
 *
 * A briefing maps a whole contested QUESTION and costs weeks. A premise card
 * maps a single CLAIM and is meant to cost minutes. It is deliberately about
 * the claim itself and not about any article: "reactors run 90 per cent of the
 * time" is the same claim whoever is leaning on it this week, so one card
 * serves every piece that rests on it. That is what makes premises the
 * reusable unit and questions the expensive one.
 *
 * The output that matters most is `status`, and specifically that SETTLED is a
 * real, reachable answer. An aggregator that always finds two sides is worse
 * than useless on a claim where the evidence is one-sided, because it converts
 * a settled matter into a live controversy for free. So the prompt is written
 * to make manufacturing balance the failure the model is warned about, and the
 * card has somewhere honest to put "this is not actually in dispute".
 *
 * Everything here is DRAFT. Quotes are proposed by the model and are worthless
 * until they have been fetched and matched character-exact against the source,
 * which is a separate step (see verify-quotes). A card that has not been
 * through that gate must never render to a reader.
 */

export const PremiseStatus = z.enum([
  // Named parties publicly disagree, and the disagreement is real rather than
  // one side being out of date.
  'contested',
  // There is a clear weight of published expert opinion. Dissent may exist and
  // is recorded, but reporting this as an open question would be misleading.
  'settled',
  // Nobody has established it either way. Usually because it is a projection,
  // a definition, or a value judgement wearing a number's clothes. This is the
  // most interesting status and the one a reader is least likely to expect.
  'unsettled',
]);

export const PremiseKind = z.enum([
  'empirical',    // a fact about the world; in principle checkable
  'predictive',   // a claim about the future; not checkable yet, ever
  'definitional', // true by how a term was defined; often smuggles the conclusion
  'normative',    // a claim about what ought to be; no amount of data settles it
]);

export const SideSchema = z.object({
  /** What this side actually holds, in one plain sentence. */
  position: z.string().min(10),
  /** The person or institution, named. Never "critics" or "some experts". */
  who: z.string().min(2),
  publication: z.string().optional(),
  /** Proposed verbatim quote. UNVERIFIED until fetched and matched. */
  quote: z.string().min(10),
  url: z.string().url().optional(),
  date: z.string().optional(),
});

export const PremiseCardSchema = z.object({
  /** The claim restated neutrally, so that it could turn out either way. */
  premise: z.string().min(10),
  kind: PremiseKind,
  status: PremiseStatus,
  /** One sentence a layman can read. Says what the status means HERE. */
  statusLine: z.string().min(20),
  /** Populated when contested. Two or three, never a false pair. */
  sides: z.array(SideSchema).max(4).default([]),
  /** Populated when settled: what the weight of opinion holds, and who dissents. */
  consensus: z
    .object({
      holds: z.string(),
      who: z.string(),
      dissent: z.string().optional(),
    })
    .optional(),
  /** The observation or argument that would move this. The most useful line. */
  whatWouldSettleIt: z.string().min(10),
  /** Anything the model is unsure of. Printed, never hidden. */
  caveats: z.array(z.string()).default([]),
});

export type PremiseCard = z.infer<typeof PremiseCardSchema>;

export const PREMISE_SYSTEM = `You map the state of public argument about ONE claim.

You are not summarising an article. You are not deciding whether the claim is
true. You are reporting where the argument on it currently stands, so a reader
meeting the claim in the wild knows whether it is safe to lean on.

THE FAILURE YOU ARE WARNED ABOUT, and it is the only one that matters: inventing
balance. If the weight of published expert opinion is clearly on one side, say
status "settled" and put the dissent in the consensus.dissent field where it
belongs. Presenting a settled claim as a live two-sided controversy is the exact
harm this exists to prevent, and it is worse than saying nothing.

The three statuses, and choose between them honestly:
- "contested": named, current, credible parties disagree on the substance.
- "settled": there is a clear weight of published expert opinion. Dissent can
  exist and should be named.
- "unsettled": nobody has established it either way. Most projections are this.
  So are claims that are true only by how a term was defined, and claims about
  what ought to happen. This status is under-used and you should reach for it
  more than feels natural.

RULES ON EVIDENCE:
- Name people and institutions. Never "critics say", "some economists", "many
  experts". If you cannot name who holds a position, you do not know that anyone
  does, and you should say so in caveats instead.
- Every quote must be wording you believe appears verbatim in the named source.
  Do not smooth, join, trim mid-sentence or paraphrase into quotation marks.
  Every quote will be fetched and matched character by character against the
  source, and any that does not match will be deleted. A missing quote costs
  nothing; an invented one is the worst thing you can produce.
- If you are unsure a quote is exact, leave the quote short, or put the claim in
  "position" as your own words and give no quote at all.
- Dates and publications where you know them, omitted where you do not. Never
  guessed.

Return ONLY a JSON object with exactly these keys and no others:

{
  "premise": "the claim restated neutrally, so it could turn out either way",
  "kind": "empirical" | "predictive" | "definitional" | "normative",
  "status": "contested" | "settled" | "unsettled",
  "statusLine": "one plain sentence saying what that status means for this claim",
  "sides": [
    {
      "position": "what this side holds, one plain sentence",
      "who": "the named person or institution",
      "publication": "optional",
      "quote": "wording you believe is verbatim in that source",
      "url": "optional, must be a real full URL if given",
      "date": "optional"
    }
  ],
  "consensus": {
    "holds": "what the weight of opinion holds",
    "who": "who holds it, named",
    "dissent": "optional, named dissent"
  },
  "whatWouldSettleIt": "the observation or argument that would move this",
  "caveats": ["anything you are unsure about"]
}

Use "sides" when status is contested, and leave it as an empty array otherwise.
Use "consensus" when status is settled, and omit it otherwise. Do not send both
a populated "sides" array and a "consensus" block.`;

export function premiseUserMessage(premise: string, context?: string): string {
  return [
    `CLAIM: ${premise}`,
    context ? `\nWHERE IT WAS ENCOUNTERED (context only, do not summarise it): ${context}` : '',
    `\nMap the state of the argument on this claim.`,
    `Restate it neutrally first, in a form that could turn out either way.`,
    `Then classify it, then say where the argument stands, then say what would move it.`,
  ].join('\n');
}

export interface BuildDeps {
  provider: LlmProvider;
  apiKey: string;
  model: string;
}

/** Generate a DRAFT card. Quotes are unverified on return, by construction. */
export async function buildPremiseCard(
  premise: string,
  deps: BuildDeps,
  context?: string,
): Promise<{ card: PremiseCard | null; raw: string; error?: string }> {
  const res = await deps.provider.complete(
    {
      operation: 'synthesize',
      model: deps.model,
      systemInstruction: PREMISE_SYSTEM,
      messages: [{ role: 'user', content: premiseUserMessage(premise, context) }],
      responseFormat: 'json',
      // Low but not zero. Zero makes it repeat one framing across related
      // claims, which on a set of premises reads as a template rather than a
      // reading of each one.
      temperature: 0.2,
      // Thinking tokens are drawn from the same budget as the answer on 2.5
      // Flash, so leaving it on truncated every card mid-sentence at 2048.
      // This is a structured recall task, not a reasoning one; it does not
      // need a scratchpad, and turning it off makes the call cheaper and
      // faster as well as complete.
      thinkingBudget: 0,
      maxTokens: 3072,
    },
    deps.apiKey,
  );

  const raw = res.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
  } catch {
    return { card: null, raw, error: 'model did not return JSON' };
  }
  const check = PremiseCardSchema.safeParse(parsed);
  if (!check.success) {
    return { card: null, raw, error: check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }

  // A settled card with a populated sides array reads as two-sided at a glance
  // however the status field is set, so the shape is normalised here rather
  // than trusted to the prompt.
  const card = check.data;
  if (card.status === 'settled' && card.sides.length > 0 && !card.consensus) {
    return { card, raw, error: 'settled but no consensus block; sides would render as false balance' };
  }
  return { card, raw };
}
