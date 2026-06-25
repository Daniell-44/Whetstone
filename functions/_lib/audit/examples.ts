// Worked-example + reference library for every named fallacy.
//
// Purpose (two uses):
//   1. Detection — a canonical example per fallacy can be injected into the
//      audit prompt so the model has a concrete anchor for each name, not just
//      a bare label. Today prompts.ts lists names only; most of the 26 have no
//      definition in the base prompt. (Wire-in is gated behind an eval A/B —
//      see Research_Engine_Improvement_v1.md — so this module is data-only.)
//   2. Display — show the reader a textbook example + an authoritative
//      reference next to a finding, so a flagged fallacy is legible and the
//      claim is checkable.
//
// `example` is illustrative prose (the kind of sentence the fallacy appears in).
// `why` is the one-line reason it qualifies. `reference` points at an
// authoritative definition. These are deliberately NOT the same as the
// one-line FALLACY_DESCRIPTIONS in taxonomy.ts — descriptions define, examples
// instantiate.

import type { FallacyName } from './taxonomy';

export interface FallacyExample {
  example:   string;
  why:       string;
  reference: string;
}

export const FALLACY_EXAMPLES: Record<FallacyName, FallacyExample> = {
  'Ad Hominem': {
    example: "You can't trust her argument for the new zoning law — she's a developer who stands to profit.",
    why: 'Targets the arguer\'s motive rather than engaging the zoning argument on its merits.',
    reference: 'https://en.wikipedia.org/wiki/Ad_hominem',
  },
  'Straw Man': {
    example: "Senators who want to cut the defence budget apparently want to leave us totally defenceless.",
    why: 'Recasts "cut the budget" as "abolish all defence", attacking a position no one held.',
    reference: 'https://en.wikipedia.org/wiki/Straw_man',
  },
  'False Dichotomy': {
    example: "Either we ban the app entirely or we accept that our children will be harmed.",
    why: 'Presents two options as exhaustive when regulation, age-gating, and other middle paths exist.',
    reference: 'https://en.wikipedia.org/wiki/False_dilemma',
  },
  'Slippery Slope': {
    example: "If we let students retake one exam, soon they'll expect to retake everything and standards will collapse.",
    why: 'Asserts a chain to an extreme outcome without justifying each step.',
    reference: 'https://en.wikipedia.org/wiki/Slippery_slope',
  },
  'Appeal to Authority': {
    example: "A Nobel laureate said the diet works, so it works.",
    why: 'Treats a credential as proof, with no underlying evidence and outside the authority\'s field.',
    reference: 'https://en.wikipedia.org/wiki/Argument_from_authority',
  },
  'Appeal to Emotion': {
    example: "Think of the families who will be devastated — that alone is why this law must pass.",
    why: 'Substitutes an emotional appeal for reasons the law is sound.',
    reference: 'https://en.wikipedia.org/wiki/Appeal_to_emotion',
  },
  'Circular Reasoning': {
    example: "The policy is the right one because it is what a sensible government would do, and a sensible government would do it.",
    why: 'The conclusion is assumed in the premise; nothing independent supports it.',
    reference: 'https://en.wikipedia.org/wiki/Circular_reasoning',
  },
  'Hasty Generalisation': {
    example: "Two start-ups I know failed after going remote, so remote work kills companies.",
    why: 'Draws a sweeping conclusion from a tiny, unrepresentative sample.',
    reference: 'https://en.wikipedia.org/wiki/Faulty_generalization',
  },
  'Red Herring': {
    example: "You ask about the missed deadline, but have you considered how hard everyone has been working?",
    why: 'Introduces an unrelated point to divert from the deadline question.',
    reference: 'https://en.wikipedia.org/wiki/Red_herring',
  },
  'Tu Quoque': {
    example: "My opponent says I broke campaign-finance rules, but he was fined for the same thing years ago.",
    why: 'Deflects the charge by pointing at the accuser instead of answering it.',
    reference: 'https://en.wikipedia.org/wiki/Tu_quoque',
  },
  'Post Hoc': {
    example: "Crime fell the year after the new mayor took office, so his policies cut crime.",
    why: 'Infers causation from mere sequence, ignoring other causes and trends.',
    reference: 'https://en.wikipedia.org/wiki/Post_hoc_ergo_propter_hoc',
  },
  'Equivocation': {
    example: "Evolution is only a theory, and theories are just guesses, so evolution is just a guess.",
    why: 'Shifts "theory" from its scientific sense to its everyday sense mid-argument.',
    reference: 'https://en.wikipedia.org/wiki/Equivocation',
  },
  'Abductive Closure': {
    example: "The lights were on and a window was open, so the only explanation is a burglary.",
    why: 'Treats one explanation as settled without ruling out others the evidence fits equally well.',
    reference: 'https://plato.stanford.edu/entries/abduction/',
  },
  'Selection Bias': {
    example: "A call-in poll of our listeners found 80% oppose the tax, so most voters oppose it.",
    why: 'The sample (self-selecting callers) is skewed before any data is chosen.',
    reference: 'https://en.wikipedia.org/wiki/Selection_bias',
  },
  'Base-Rate Neglect': {
    example: "The test is 99% accurate and she tested positive, so she almost certainly has the rare disease.",
    why: 'Ignores how rare the disease is, which dominates the true probability.',
    reference: 'https://en.wikipedia.org/wiki/Base_rate_fallacy',
  },
  'No True Scotsman': {
    example: "No real environmentalist would ever fly. — But this one does. — Then she isn't a real environmentalist.",
    why: 'Redefines the category to exclude the counter-example rather than concede it.',
    reference: 'https://en.wikipedia.org/wiki/No_true_Scotsman',
  },
  'Cherry-Picking': {
    example: "Three studies found the supplement helps, so it works (the other nine showing no effect go unmentioned).",
    why: 'Cites only the favourable items from an available body of evidence.',
    reference: 'https://en.wikipedia.org/wiki/Cherry_picking',
  },
  'Texas Sharpshooter': {
    example: "Our cancer rates spike in exactly the three towns near the plant — proof the plant causes cancer.",
    why: 'Draws the target around a cluster spotted after the fact, ignoring the many towns that don\'t fit.',
    reference: 'https://en.wikipedia.org/wiki/Texas_sharpshooter_fallacy',
  },
  'Composition': {
    example: "Every player on the team is a star, so the team is unbeatable.",
    why: 'Assumes what is true of each part is automatically true of the whole.',
    reference: 'https://en.wikipedia.org/wiki/Fallacy_of_composition',
  },
  'Division': {
    example: "It's the best orchestra in the country, so every musician in it must be the best at their instrument.",
    why: 'Assumes what is true of the whole is true of each part.',
    reference: 'https://en.wikipedia.org/wiki/Fallacy_of_division',
  },
  'Argument from Ignorance': {
    example: "No one has proven the supplement is unsafe, so it must be safe.",
    why: 'Treats absence of disproof as proof.',
    reference: 'https://en.wikipedia.org/wiki/Argument_from_ignorance',
  },
  'Gish Gallop': {
    example: "Here are twenty quick reasons the treaty is a disaster — rebut them all or concede I'm right.",
    why: 'Floods the exchange with many weak points so none can be properly answered.',
    reference: 'https://en.wikipedia.org/wiki/Gish_gallop',
  },
  'Moving the Goalposts': {
    example: "Show me one study. — Here are three. — Well, none is a 20-year randomised trial, so they don't count.",
    why: 'Raises the evidentiary bar once the original demand is met.',
    reference: 'https://en.wikipedia.org/wiki/Moving_the_goalposts',
  },
  'Motte-and-Bailey': {
    example: "Astrology shapes our destiny. — That's unfounded. — I just mean the seasons affect mood. — [later] As destiny shows…",
    why: 'Retreats to a defensible claim under pressure, then re-advances the controversial one as if defended.',
    reference: 'https://en.wikipedia.org/wiki/Motte-and-bailey_fallacy',
  },
  'Special Pleading': {
    example: "Everyone should pay their fair share of tax — except entrepreneurs like me, who are different.",
    why: 'Exempts a favoured case from a general rule with no principled reason for the exemption.',
    reference: 'https://en.wikipedia.org/wiki/Special_pleading',
  },
  'Genetic Fallacy': {
    example: "That idea came out of a corporate think tank, so it must be self-serving and wrong.",
    why: 'Judges the claim by its origin rather than its content.',
    reference: 'https://en.wikipedia.org/wiki/Genetic_fallacy',
  },
};
