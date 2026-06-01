// User-facing labels for analytical concepts.
// Code, schemas, prompts, and database fields use their precise technical names.
// THIS FILE controls only what appears on user-visible UI surfaces.

export const LABELS = {
  // Audit lenses
  toulmin:          'Argument Structure',
  namedFallacies:   'Reasoning Patterns',
  loadedLanguage:   'Word Choice',
  unstatedWarrants: 'Hidden Assumptions',
  centralClaim:     'Main Claim',
  weakestLink:      'Weakest Point',

  // Phase-2 lenses
  keyTermScrutiny:      'Word Use',
  referentChecks:       'Vague References',
  falsifiabilityChecks: 'Testability',

  // Argument extraction
  extraction:              'Argument Structure',
  extractionPremise:       'Premise',
  extractionConclusion:    'Conclusion',
  extractionInferenceRule: 'Inference',

  // Counterargument
  counterarguments:   'Strongest Opposing Cases',
  counterargPosition: 'Position',
  counterargCase:     'Their Strongest Case',
  missedByDraft:      "What your draft doesn't engage with",
  counterargWhy:      'Why this opposition is hard to dismiss',

  // Toulmin sub-fields
  toulminClaim:   'The claim',
  toulminGrounds: 'The evidence',
  toulminWarrant: 'The connecting assumption',

  // Comparison view section labels
  diffRemoved:   'Fixed in the revision',
  diffAdded:     'Newly appeared',
  diffPersisted: 'Still present',
} as const;

export const TOOLTIPS: Record<keyof typeof LABELS, { plain: string; pedigree: string }> = {
  toulmin: {
    plain:    'How the argument holds together: what it claims, what evidence supports it, and the assumption bridging them.',
    pedigree: 'Based on Stephen Toulmin\'s framework for mapping real-world arguments, developed in The Uses of Argument (1958).',
  },
  namedFallacies: {
    plain:    'Specific, documented patterns of flawed reasoning — like false dichotomies or attacking the person instead of the argument.',
    pedigree: 'The catalogue of named fallacies traces back to Aristotle\'s Sophistical Refutations and has been refined for two millennia.',
  },
  loadedLanguage: {
    plain:    'Phrases designed to nudge readers toward a conclusion through emotion or framing rather than evidence.',
    pedigree: 'Identifying loaded language is a core concern of rhetorical analysis going back to classical Greek rhetoric.',
  },
  unstatedWarrants: {
    plain:    'Assumptions the argument needs in order to hold but never states — readers who don\'t share them won\'t be convinced.',
    pedigree: 'In Toulmin\'s framework these are "warrants": the load-bearing premises a careful reader must supply themselves.',
  },
  centralClaim: {
    plain:    'The core conclusion the piece is arguing for — what the author wants you to believe or do.',
    pedigree: 'Toulmin called this the "claim": the proposition whose acceptance is the goal of the argument.',
  },
  weakestLink: {
    plain:    'The point in the argument most open to challenge — where the reasoning is thinnest or the evidence softest.',
    pedigree: 'Part of Toulmin\'s framework: every argument has a load-bearing element that, if contested, collapses the whole chain.',
  },
  keyTermScrutiny: {
    plain:    'Key terms used inconsistently — sliding between different meanings in a way that makes the argument appear to hold when it doesn\'t.',
    pedigree: 'Grounded in Wittgenstein\'s insight that meaning is use: when a term shifts its language-game mid-argument, the inference silently breaks down.',
  },
  referentChecks: {
    plain:    'Phrases whose referents are empty, contested, or presuppose facts not established in the text.',
    pedigree: 'Grounded in Russell\'s theory of descriptions: definite descriptions fail when their referents don\'t exist or aren\'t determinate.',
  },
  falsifiabilityChecks: {
    plain:    'Claims that appear substantive but have no conditions under which they could be false.',
    pedigree: 'Grounded in Davidson\'s truth-conditional semantics: a sentence only means something if we know what would make it true or false.',
  },
  extraction: {
    plain:    'Your argument rendered as numbered premises and conclusions — clarifying the logical skeleton before critique.',
    pedigree: 'Follows the tradition of argument formalisation from Aristotle\'s syllogistic through modern informal logic.',
  },
  extractionPremise: {
    plain:    'A load-bearing claim the argument asserts or assumes as a starting point.',
    pedigree: 'In classical logic, premises are the propositions from which conclusions are derived.',
  },
  extractionConclusion: {
    plain:    'A claim derived from one or more premises via an inference rule.',
    pedigree: 'A conclusion is valid only if the inference from its premises is truth-preserving under the stated rule.',
  },
  extractionInferenceRule: {
    plain:    'The pattern of reasoning used to derive this conclusion from its premises.',
    pedigree: 'Inference rules formalise the permissible moves in an argument; naming them makes the argument\'s logic explicit and checkable.',
  },
  counterarguments: {
    plain:    'The strongest objections a thoughtful opponent would make — ones your draft currently doesn\'t address.',
    pedigree: 'This is steelmanning: engaging the best version of the opposing view, not a weakened caricature of it.',
  },
  counterargPosition: {
    plain:    'The opposing view being articulated — stated clearly on its own terms, not as a rebuttal.',
    pedigree: 'Each counterargument is a distinct position with its own grounds and internal warrant, not merely a negation.',
  },
  counterargCase: {
    plain:    'The evidence and reasoning that makes this opposing position genuinely difficult to dismiss.',
    pedigree: 'Structured using the same Toulmin claim–grounds–warrant chain as the original argument\'s analysis.',
  },
  missedByDraft: {
    plain:    'The specific thing the draft fails to engage with — concrete, not a generic observation.',
    pedigree: 'The gap between an argument and its strongest opposition is where intellectual credibility is won or lost.',
  },
  counterargWhy: {
    plain:    'Why a well-informed reader would actually hold this opposing view and find it compelling.',
    pedigree: 'Understanding the motivation behind an objection is what distinguishes steelmanning from mere devil\'s advocacy.',
  },
  toulminClaim: {
    plain:    'The conclusion the argument is trying to establish — what it\'s asking you to accept.',
    pedigree: 'Toulmin\'s "claim" is the first node in his argument model; every other element exists to support it.',
  },
  toulminGrounds: {
    plain:    'The evidence offered in support of the claim — the data, examples, or facts the argument rests on.',
    pedigree: 'Toulmin\'s "grounds" (also called "data") are the empirical or factual foundation of the argument.',
  },
  toulminWarrant: {
    plain:    'The assumption that connects the evidence to the conclusion — often unstated, but essential.',
    pedigree: 'Toulmin\'s "warrant" is the principle licensing the move from grounds to claim; it\'s the argument\'s key premise.',
  },
  diffRemoved: {
    plain:    'Issues present in the earlier version that are no longer present in the revision.',
    pedigree: 'A reduction in identified issues suggests the revision addressed structural weaknesses in the original argument.',
  },
  diffAdded: {
    plain:    'Issues that weren\'t present in the earlier version but appear in the revision.',
    pedigree: 'New issues in a revision can indicate that changes introduced unintended rhetorical or logical problems.',
  },
  diffPersisted: {
    plain:    'Issues that were present in the earlier version and remain unchanged in the revision.',
    pedigree: 'Persisting issues indicate areas where the argument\'s structural problems have not yet been addressed.',
  },
};
