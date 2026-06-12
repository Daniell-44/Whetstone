// User-facing labels for analytical concepts.
// Code, schemas, prompts, and database fields use their precise technical names.
// THIS FILE controls only what appears on user-visible UI surfaces.

export type TerminologyPreference = 'plain' | 'formal';

// ---------------------------------------------------------------------------
// Deeper-lens button labels. These 5 lenses previously hardcoded academic
// names that ignored the Plain/Formal toggle. This dedicated map wires them in
// without forcing tooltip entries for each (they have their own inline blurbs).
// ---------------------------------------------------------------------------

export const DEEPER_LENS_KEYS = [
  'presupposition', 'rhetoricalMode', 'epistemicHumility', 'disagreementEngagement', 'structuralIncentive',
] as const;
export type DeeperLensKey = typeof DEEPER_LENS_KEYS[number];

export const DEEPER_LENS_LABELS: Record<TerminologyPreference, Record<DeeperLensKey, string>> = {
  plain: {
    presupposition:         'Taken for Granted',
    rhetoricalMode:         'How It Persuades',
    epistemicHumility:      'Certainty Check',
    disagreementEngagement: 'Fairness to Critics',
    structuralIncentive:    'Who Benefits',
  },
  formal: {
    presupposition:         'Presuppositions',
    rhetoricalMode:         'Rhetorical Mode',
    epistemicHumility:      'Epistemic Humility',
    disagreementEngagement: 'Disagreement Engagement',
    structuralIncentive:    'Structural Incentive',
  },
};

export function getDeeperLensLabels(preference?: TerminologyPreference): Record<DeeperLensKey, string> {
  return preference === 'formal' ? DEEPER_LENS_LABELS.formal : DEEPER_LENS_LABELS.plain;
}

// ---------------------------------------------------------------------------
// Plain labels (accessible English)
// ---------------------------------------------------------------------------

export const LABELS_PLAIN = {
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

  // Philosophical commitments
  commitments:                 'Framework Check',
  commitmentsEthical:          'Ethical Framework',
  commitmentsEpistemic:        'How it decides what\'s true',
  commitmentsPolitical:        'Political Framework',
  commitmentsMethodological:   'How it explains things',
  commitmentsAlternatives:     'Alternative Perspectives',

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

  // Modal scope
  modalScopeChecks: 'Certainty Claims',

  // Structural validity
  structuralValidity:           'Argument Form Check',
  validityVerdictValid:         'Logically valid',
  validityVerdictInvalid:       'Conclusion doesn\'t follow',
  validityVerdictInductive:     'Probable but not certain',
  validityVerdictEnthymematic:  'Needs hidden premises',
  validityVerdictIndeterminate: 'Too ambiguous to check',

  // Citation audit
  citationAudit:              'Source Match',
  citationVerdictWell:        'Source clearly supports',
  citationVerdictWeak:        'Source partly supports',
  citationVerdictMismatch:    "Source doesn't say that",
  citationVerdictUncited:     'No source given',
  citationVerdictUnfetchable: 'Source unreachable',

  // Tone and rhetorical posture
  tonePosture:          'Tone & Posture',
  postureLabel:         'How the argument addresses you',
  registerLabel:        'Emotional temperature',
  tonalMovesLabel:      'Where tone does the work',
  audiencePositionLabel: 'The role it puts you in',

  // Evidence-weighted likelihood
  evidenceWeighted:             'Evidence Check',
  consensusStrongSupport:       'Well-established',
  consensusModerateSupport:     'Mostly supported',
  consensusContested:           'Actively debated',
  consensusModerateOpposition:  'Mostly opposed',
  consensusStrongOpposition:    'Strongly refuted',
  consensusInsufficient:        'Not enough research',
  consensusNotApplicable:       'Not an empirical claim',
} as const;

// ---------------------------------------------------------------------------
// Formal labels (precise philosophical terminology)
// ---------------------------------------------------------------------------

export const LABELS_FORMAL = {
  toulmin:               'Toulmin Decomposition',
  namedFallacies:        'Named Fallacies',
  loadedLanguage:        'Loaded Language',
  unstatedWarrants:      'Unstated Warrants',
  centralClaim:          'Central Claim',
  weakestLink:           'Weakest Link',

  keyTermScrutiny:       'Wittgensteinian Key-Term Scrutiny',
  referentChecks:        'Russellian Referent Check',
  falsifiabilityChecks:  'Davidsonian Falsifiability Check',

  extraction:              'Argument Extraction',
  extractionPremise:       'Premise',
  extractionConclusion:    'Conclusion',
  extractionInferenceRule: 'Inference Rule',

  commitments:                'Philosophical Commitments',
  commitmentsEthical:         'Ethical framework',
  commitmentsEpistemic:       'Epistemic commitments',
  commitmentsPolitical:       'Political framework',
  commitmentsMethodological:  'Methodological commitments',
  commitmentsAlternatives:    'Alternative philosophical perspectives',

  counterarguments:   'Counterarguments',
  counterargPosition: 'Opposing position',
  counterargCase:     'Strongest case (Toulmin)',
  missedByDraft:      'Inferential gap in the draft',
  counterargWhy:      'Dialectical resilience',

  toulminClaim:   'Claim',
  toulminGrounds: 'Grounds',
  toulminWarrant: 'Warrant',

  diffRemoved:   'Findings resolved between revisions',
  diffAdded:     'Findings introduced in the new revision',
  diffPersisted: 'Findings persisting across revisions',

  modalScopeChecks: 'Modal Scope Check',

  structuralValidity:           'Structural Validity Check',
  validityVerdictValid:         'Deductively valid',
  validityVerdictInvalid:       'Deductively invalid',
  validityVerdictInductive:     'Inductively strong',
  validityVerdictEnthymematic:  'Enthymematic (suppressed premises)',
  validityVerdictIndeterminate: 'Formally indeterminate',

  citationAudit:              'Citation Audit',
  citationVerdictWell:        'Citation alignment: strong',
  citationVerdictWeak:        'Citation alignment: weak',
  citationVerdictMismatch:    'Citation–claim mismatch',
  citationVerdictUncited:     'Uncited assertion',
  citationVerdictUnfetchable: 'Citation retrieval failed',

  // Tone and rhetorical posture
  tonePosture:          'Rhetorical Posture & Tonal Register',
  postureLabel:         'Rhetorical posture',
  registerLabel:        'Tonal register',
  tonalMovesLabel:      'Tonal moves (rhetoric doing argumentative work)',
  audiencePositionLabel: 'Audience position',

  // Evidence-weighted likelihood
  evidenceWeighted:             'Evidence-Weighted Likelihood',
  consensusStrongSupport:       'Strong scientific consensus in support',
  consensusModerateSupport:     'Moderate scientific consensus in support',
  consensusContested:           'Actively contested in the literature',
  consensusModerateOpposition:  'Moderate scientific consensus opposing',
  consensusStrongOpposition:    'Strong scientific consensus opposing',
  consensusInsufficient:        'Insufficient empirical data',
  consensusNotApplicable:       'Not empirically assessable',
} as const satisfies { [K in keyof typeof LABELS_PLAIN]: string };

// ---------------------------------------------------------------------------
// Plain tooltips
// ---------------------------------------------------------------------------

export const TOOLTIPS_PLAIN: Record<keyof typeof LABELS_PLAIN, { plain: string; pedigree: string }> = {
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
  commitments: {
    plain:    'The implicit philosophical frameworks your argument assumes — ethical, epistemic, political, and methodological.',
    pedigree: 'Every argument embeds framework-level assumptions that determine what counts as a good reason; surfacing these is the first step toward anticipating objections from readers who hold different frameworks.',
  },
  commitmentsEthical: {
    plain:    'The ethical framework your argument leans on when deciding what matters morally.',
    pedigree: 'Ethical frameworks — consequentialism, deontology, virtue ethics, contractualism — provide the underlying criteria for moral reasoning; arguments can be valid within one framework and invalid within another.',
  },
  commitmentsEpistemic: {
    plain:    'How your argument decides what counts as good evidence or reliable knowledge.',
    pedigree: 'Epistemic commitments — empiricism, rationalism, appeal to authority, experiential knowledge — determine what the argument treats as a legitimate reason to believe something.',
  },
  commitmentsPolitical: {
    plain:    'The political framework shaping the argument\'s assumptions about society, rights, and collective action.',
    pedigree: 'Political frameworks — liberal, communitarian, libertarian, progressive — embed different priors about the relationship between individuals and institutions.',
  },
  commitmentsMethodological: {
    plain:    'Whether the argument explains things by breaking them into parts, situating them in larger systems, or some mix.',
    pedigree: 'Methodological commitments — reductionism vs holism, individualism vs structuralism, universalism vs contextualism — determine the level at which explanations are pitched.',
  },
  commitmentsAlternatives: {
    plain:    'Objections from readers who hold different frameworks — not generic counterarguments, but critiques rooted in framework-level disagreement.',
    pedigree: 'Framework-level objections reveal blind spots that evidence alone cannot resolve; they identify the background assumptions an argument must defend, not just the claims it asserts.',
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
  modalScopeChecks: {
    plain:    'Places where the argument asserts more certainty than the evidence warrants — using "will" or "must" where "might" or "could" is all the reasoning supports.',
    pedigree: 'Grounded in modal logic\'s distinction between necessity (□) and possibility (◇). In natural language arguments, the substitution of necessity operators for possibility operators — "this will happen" for "this might happen" — is a pervasive form of epistemic overclaiming that misleads readers about the strength of evidential support.',
  },

  structuralValidity: {
    plain:    'Does the conclusion actually follow from the premises? This check strips away the content and looks at the argument\'s logical form — whether the structure itself guarantees that if the premises are true, the conclusion must be true.',
    pedigree: 'The distinction between validity and soundness goes back to Aristotle\'s Prior Analytics (c. 350 BCE). An argument is valid if its form is truth-preserving: no possible world makes the premises true and the conclusion false. Soundness adds that the premises are actually true. The Whetstone assesses validity only — form, not factual truth.',
  },
  validityVerdictValid: {
    plain:    'The conclusion follows necessarily. If the premises are true, the conclusion must be true — no exceptions.',
    pedigree: 'Deductive validity: in every model where the premises hold, the conclusion holds. The gold standard of logical entailment since Aristotle; formalised in Tarski\'s model-theoretic semantics (1936).',
  },
  validityVerdictInvalid: {
    plain:    'The conclusion doesn\'t follow from the premises. There\'s a scenario where everything the argument claims is true, but the conclusion is still false.',
    pedigree: 'Deductive invalidity is demonstrated by a countermodel: a logically possible interpretation in which the premises are satisfied and the conclusion is not. This is the standard proof method in model theory.',
  },
  validityVerdictInductive: {
    plain:    'The premises make the conclusion likely, but don\'t guarantee it. The argument is strong but not airtight.',
    pedigree: 'Inductive strength: the premises raise the probability of the conclusion without entailing it. Distinguished from deductive validity since Hume (A Treatise of Human Nature, 1739); formalised in Carnap\'s inductive logic and Bayesian confirmation theory.',
  },
  validityVerdictEnthymematic: {
    plain:    'The argument relies on premises it doesn\'t state. Adding those hidden premises would make it valid — but some of them might be controversial.',
    pedigree: 'The enthymeme — a syllogism with a suppressed premise — was identified by Aristotle in the Rhetoric as the standard form of ordinary persuasion. Most real-world arguments are enthymematic; identifying the suppressed premises is the first step toward assessing whether the argument actually works.',
  },
  validityVerdictIndeterminate: {
    plain:    'The argument is too vague or ambiguous to assess formally — its logical structure can\'t be pinned down with confidence.',
    pedigree: 'Some natural-language arguments resist formalisation due to scope ambiguity, vague predicates, or underspecified logical connectives. The indeterminate verdict acknowledges this rather than forcing a misleading formalisation.',
  },

  citationAudit: {
    plain:    'For each factual claim in your draft that\'s backed by a cited source, we fetch the source and check whether it actually supports the claim. Mismatches and uncited claims are flagged so you can address them before publishing.',
    pedigree: 'Operationalises a core editorial discipline — verifying that citations actually establish what they\'re cited for — at the speed of LLM inference.',
  },
  citationVerdictWell: {
    plain:    'The cited source clearly and directly supports this claim.',
    pedigree: 'The claim\'s propositional content is present in the source text with sufficient specificity to constitute genuine evidential support.',
  },
  citationVerdictWeak: {
    plain:    'The cited source is related to the topic but doesn\'t fully back the specific claim made.',
    pedigree: 'Partial support: the source is relevant but does not establish the claim\'s specific quantitative, temporal, or causal assertion.',
  },
  citationVerdictMismatch: {
    plain:    'The source contradicts or says something different from what the draft claims it does.',
    pedigree: 'Citation–claim mismatch: the source\'s propositional content is inconsistent with or materially different from the claim attributed to it.',
  },
  citationVerdictUncited: {
    plain:    'This factual claim has no cited source.',
    pedigree: 'Uncited factual assertion: a claim about the state of the world that the draft presents as fact without providing a verifiable source.',
  },
  citationVerdictUnfetchable: {
    plain:    'The cited source couldn\'t be retrieved — it may be paywalled, removed, or unavailable.',
    pedigree: 'Citation retrieval failed: the source exists but could not be accessed for automated verification (HTTP 4xx, paywall, or network error).',
  },

  // Tone and rhetorical posture
  tonePosture: {
    plain:    'How your writing addresses its audience — the stance you take (authoritative, conciliatory, adversarial, etc.) and the emotional temperature of the prose (measured, urgent, sardonic, etc.). This isn\'t about what you argue; it\'s about how you argue it.',
    pedigree: 'Rhetorical analysis in the tradition of Aristotle\'s Rhetoric (ethos, pathos, logos) and Kenneth Burke\'s dramatistic pentad (A Grammar of Motives, 1945). The posture-register distinction maps to Wayne Booth\'s concept of the "implied author" (The Rhetoric of Fiction, 1961) — the persona the text constructs for its writer, which may differ from the writer\'s actual stance.',
  },
  postureLabel: {
    plain:    'The implicit role you cast yourself and the reader in — are you the expert, the ally, the teacher, the prophet?',
    pedigree: 'Relates to Aristotle\'s ethos: the character the speaker constructs through the speech itself, not their pre-existing reputation.',
  },
  registerLabel: {
    plain:    'The emotional temperature of the prose — calm, urgent, angry, witty, clinical. Different from posture: you can be authoritative and measured, or authoritative and urgent.',
    pedigree: 'Register analysis from systemic functional linguistics (Halliday, Language as Social Semiotic, 1978): field (topic), tenor (social relationship), and mode (channel) jointly constitute the register.',
  },
  tonalMovesLabel: {
    plain:    'Specific passages where the way something is said matters as much as what is said — where rhetorical technique substitutes for or amplifies the logical content.',
    pedigree: 'Perelman & Olbrechts-Tyteca\'s concept of "presence" (The New Rhetoric, 1958): rhetorical techniques that make certain elements more salient to the audience, affecting which premises receive emphasis independent of their logical weight.',
  },
  audiencePositionLabel: {
    plain:    'How the text positions you as a reader — as an expert, a student, a juror, an ally, a witness to injustice.',
    pedigree: 'Reader-response theory (Iser, The Implied Reader, 1974): every text constructs an "implied reader" whose role, knowledge, and sympathies are built into the text\'s structure.',
  },

  // Evidence-weighted likelihood
  evidenceWeighted: {
    plain:    'For each factual claim in your argument, we search the academic literature and assess how strongly the evidence supports or opposes it. Non-factual claims (value judgments, definitions) are flagged as such — they don\'t get percentages.',
    pedigree: 'Evidence synthesis draws on the Semantic Scholar corpus (200M+ papers). Consensus assessment distinguishes between claim types: empirical claims receive evidence-weighted confidence; normative claims are identified as value judgments where empirical consensus is categorically inapplicable. Based on the philosophical distinction between is-statements and ought-statements (Hume\'s guillotine, A Treatise of Human Nature, 1739).',
  },
  consensusStrongSupport: {
    plain:    'The scientific literature strongly supports this claim. ≥80% of relevant research points in the same direction, including well-cited recent work.',
    pedigree: 'Strong consensus: the claim is well-established across the relevant literature, with consistent findings across multiple independent research groups and methodologies.',
  },
  consensusModerateSupport: {
    plain:    'Most of the research supports this claim, but there\'s some notable dissent or methodological disagreement.',
    pedigree: 'Moderate consensus: 55–79% of relevant papers support the claim, but meaningful counter-evidence or methodological criticism exists in the literature.',
  },
  consensusContested: {
    plain:    'The scientific community is genuinely split on this. Evidence points in different directions, and the honest answer is that we don\'t know yet.',
    pedigree: 'Contested: the literature is roughly balanced, or methodological disagreements prevent convergence. This is the epistemically honest assessment — forced certainty on contested evidence is itself a form of misleading the reader.',
  },
  consensusModerateOpposition: {
    plain:    'Most of the research leans against this claim, though it has some support.',
    pedigree: 'Moderate opposition: 55–79% of relevant papers contradict or fail to support the claim.',
  },
  consensusStrongOpposition: {
    plain:    'The scientific literature strongly opposes this claim. The mainstream view rejects it.',
    pedigree: 'Strong opposition: ≥80% of relevant research contradicts the claim. The scientific consensus decisively rejects the position.',
  },
  consensusInsufficient: {
    plain:    'Not enough relevant research was found to assess whether this claim is true. This doesn\'t mean it\'s wrong — it means the evidence base is too thin to judge.',
    pedigree: 'Insufficient data: fewer than 3 relevant papers found, or retrieved papers do not bear directly on the claim. Absence of evidence is not evidence of absence (Altman & Bland, BMJ 1995).',
  },
  consensusNotApplicable: {
    plain:    'This isn\'t the kind of claim that scientific evidence can settle. It\'s a value judgment, a definition, or a prediction — not a factual assertion that research can verify.',
    pedigree: 'The is–ought gap (Hume, 1739; Moore\'s naturalistic fallacy, 1903): normative claims cannot be derived from empirical premises alone. Assigning a confidence percentage to a value judgment would mislead the reader into thinking the question has a factual answer.',
  },
};

// ---------------------------------------------------------------------------
// Formal tooltips (denser technical pedigree)
// ---------------------------------------------------------------------------

export const TOOLTIPS_FORMAL = {
  toulmin: {
    plain:    'Structural decomposition of an argument into its constitutive elements: claim, grounds, warrant, backing, qualifier, and rebuttal.',
    pedigree: 'Stephen Toulmin, The Uses of Argument (1958). Toulmin proposed this model as an alternative to formal syllogistic, arguing that real-world arguments are field-dependent and cannot be assessed by a single formal criterion.',
  },
  namedFallacies: {
    plain:    'Detection of informal fallacies — catalogued patterns of non-sequitur reasoning including ad hominem, false dichotomy, straw man, hasty generalisation, and their cognates.',
    pedigree: 'Aristotle, Sophistical Refutations (c. 350 BCE). The taxonomy has been extended by Hansen & Pinto (Fallacies: Classical and Contemporary Readings, 1995) and Douglas Walton\'s pragma-dialectical treatment of fallacy as violation of dialogue norms.',
  },
  loadedLanguage: {
    plain:    'Identification of evaluative language, weasel words, and framing devices that generate inferential force through affect or presupposition rather than explicit reasoning.',
    pedigree: 'Classical rhetoric (inventio, dispositio, elocutio); modernised by Perelman & Olbrechts-Tyteca\'s theory of rhetorical presence (The New Rhetoric, 1958) and Fairclough\'s critical discourse analysis.',
  },
  unstatedWarrants: {
    plain:    'Explication of suppressed premises — the bridging warrants an argument requires but does not assert, whose denial is sufficient to block the inference from grounds to claim.',
    pedigree: 'Toulmin\'s "warrants" (The Uses of Argument, 1958); related to the Aristotelian enthymeme, in which one premise is left implicit, and to the suppressed major premise of the syllogism.',
  },
  centralClaim: {
    plain:    'The argument\'s principal propositional target — the conclusion all other elements are marshalled to establish.',
    pedigree: 'Toulmin\'s "claim" (The Uses of Argument, 1958) is the first node in his model; in classical rhetoric it corresponds to the thesis or propositio of a dispositio.',
  },
  weakestLink: {
    plain:    'The argument\'s most vulnerable node — the premise or warrant whose contestation is necessary and sufficient to block the conclusion.',
    pedigree: 'A corollary of Toulmin\'s model: the inferential chain is only as strong as its weakest warrant or least-supported ground. Related to the concept of the argument\'s "crux" in pragma-dialectics.',
  },
  keyTermScrutiny: {
    plain:    'Detection of equivocation — cases where a single lexical item traverses two or more language-games within the argument, producing the illusion of a valid inference across an implicit semantic discontinuity.',
    pedigree: 'Wittgenstein, Philosophical Investigations (1953): "the meaning of a word is its use in the language." Equivocation is the canonical informal fallacy arising from semantic drift; formalised in intensional logic as a type-shift across senses.',
  },
  referentChecks: {
    plain:    'Application of Russellian analysis to detect definite descriptions with null, indeterminate, or contested referents — propositions that presuppose existential facts the text has not established.',
    pedigree: 'Bertrand Russell, "On Denoting" (Mind, 1905). Russell\'s theory of descriptions analyses "the F" as a quantified claim; it fails when no unique F exists, generating a presupposition failure rather than a false proposition.',
  },
  falsifiabilityChecks: {
    plain:    'Identification of claims that lack determinate truth-conditions — propositions for which no possible state of affairs would constitute disconfirmation, rendering them empirically vacuous.',
    pedigree: 'Karl Popper, The Logic of Scientific Discovery (1934/1959) for falsifiability as the demarcation criterion; Donald Davidson\'s truth-conditional semantics (Inquiries into Truth and Interpretation, 1984) for the connection between meaning and falsifiability conditions.',
  },
  extraction: {
    plain:    'Formalisation of the argument into its logical skeleton: an enumerated sequence of premises, intermediate conclusions, and final conclusions, each governed by an explicit inference rule.',
    pedigree: 'Traces from Aristotle\'s Prior Analytics (syllogistic) through Frege\'s Begriffsschrift (1879) to contemporary informal logic\'s argument diagramming tradition (Freeman, Argument Structure, 1991).',
  },
  extractionPremise: {
    plain:    'A proposition asserted or presupposed as a starting point from which, in conjunction with other premises, conclusions are derivable.',
    pedigree: 'In classical logic a premise is a proposition granted for the purposes of inference; in Aristotle\'s syllogistic, the major and minor premises together necessitate the conclusion.',
  },
  extractionConclusion: {
    plain:    'A proposition derived from antecedent premises via an explicit inference rule — valid if and only if the inference rule is truth-preserving over the premises.',
    pedigree: 'In classical logic, a conclusion follows necessarily from premises under deductive inference; in modern informal logic (Govier, A Practical Study of Argument), conclusions may also follow inductively or abductively.',
  },
  extractionInferenceRule: {
    plain:    'The inferential schema licensing the move from premises to conclusion — deductive (modus ponens, hypothetical syllogism), inductive (enumerative, analogical), or abductive (inference to the best explanation).',
    pedigree: 'Inference rules formalise the permissible moves in an argument system. Frege codified deductive rules in Begriffsschrift (1879); Peirce introduced abduction as a third mode of inference alongside deduction and induction.',
  },
  commitments: {
    plain:    'Identification of the argument\'s implicit framework-level commitments across four dimensions: ethical, epistemic, political, and methodological — the background assumptions that determine what counts as a good reason within the argument.',
    pedigree: 'Informed by Rawls\'s reflective equilibrium (A Theory of Justice, 1971), Kuhn\'s paradigm analysis (The Structure of Scientific Revolutions, 1962), and MacIntyre\'s tradition-constituted rationality (Whose Justice? Which Rationality?, 1988).',
  },
  commitmentsEthical: {
    plain:    'The normative-ethical framework structuring the argument\'s moral reasoning — consequentialism, deontology, virtue ethics, contractualism, or a pluralist combination — identified by the evaluative criteria the argument treats as decisive.',
    pedigree: 'The major ethical frameworks are: consequentialism (Bentham, Mill); deontology (Kant, Korsgaard); virtue ethics (Aristotle, MacIntyre); contractualism (Rawls, Scanlon). Each yields different verdicts on the same factual situation.',
  },
  commitmentsEpistemic: {
    plain:    'The argument\'s operative criteria for justified belief — empiricism (privileging observation and experiment), rationalism (privileging a priori inference), testimonial authority, or experiential warrant — identified by what the argument treats as a legitimate reason to believe a proposition.',
    pedigree: 'Classical division between empiricism (Locke, Hume, Mill) and rationalism (Descartes, Leibniz, Kant); extended by social epistemology (Goldman, Fricker) to include testimonial and experiential sources of knowledge.',
  },
  commitmentsPolitical: {
    plain:    'The political-philosophical priors structuring the argument\'s assumptions about the priority of rights vs welfare, the legitimate scope of collective action, and the relationship between individuals and institutions.',
    pedigree: 'Political philosophy tradition: liberalism (Locke, Rawls, Dworkin), libertarianism (Nozick, Hayek), communitarianism (MacIntyre, Sandel, Walzer), progressivism (Dewey, Rawls\'s later work), socialism (Marx, G. A. Cohen).',
  },
  commitmentsMethodological: {
    plain:    'The explanatory strategy the argument deploys: reductionism (explaining phenomena by their components), holism (explaining by systemic relations), individualism (grounding social facts in individual behaviour), structuralism (grounding behaviour in structural position), universalism (cross-context generalisation), or contextualism (local specification).',
    pedigree: 'Methodological individualism vs structuralism: Popper vs Durkheim; reductionism vs holism: Nagel vs Putnam; universalism vs contextualism: a core fault-line in philosophy of social science (Winch, The Idea of a Social Science, 1958).',
  },
  commitmentsAlternatives: {
    plain:    'Objections generated by rotating the argument\'s framework-level commitments: critiques that arise not from different empirical assessments but from irreducibly different background assumptions about what constitutes a good reason.',
    pedigree: 'Framework-level objections identify the points at which the argument\'s rationality is tradition-constituted (MacIntyre) or paradigm-relative (Kuhn) — the background commitments an argument must defend before its first-order claims can be assessed.',
  },
  counterarguments: {
    plain:    'Steelmanned opposing positions — the strongest arguments against the draft\'s thesis, reconstructed charitably using Toulmin structure and free of dialectical distortion.',
    pedigree: 'Steelmanning as a methodological ideal: engaging the best version of the opposing view. Contrasted with the straw-man fallacy by Walton (Informal Logic, 1989); related to Rawls\'s principle of interpretive charity.',
  },
  counterargPosition: {
    plain:    'The propositional content of an opposing view, stated on its own terms without reductive paraphrase — each counterargument is a distinct position with its own grounds and warrant, not merely a negation of the thesis.',
    pedigree: 'Each counterargument is an independent argument in the pragma-dialectical sense (van Eemeren & Grootendorst, A Systematic Theory of Argumentation, 2004): it advances a standpoint, does not merely deny one.',
  },
  counterargCase: {
    plain:    'The grounds and warrant supporting the opposing position, reconstructed using Toulmin\'s claim–grounds–warrant model — identifying the evidentiary basis and inference-licensing principle that make the opposition genuinely difficult to dismiss.',
    pedigree: 'Toulmin model applied to adversarial reconstruction (The Uses of Argument, 1958); related to the burden-of-proof analysis in pragma-dialectics, which requires identifying which party bears the onus of providing grounds.',
  },
  missedByDraft: {
    plain:    'The specific inferential gap or unengaged objection that diminishes the draft\'s dialectical completeness — the precise point at which a rational interlocutor holding the opposing view would find the argument insufficient.',
    pedigree: 'Dialectical completeness is a norm of pragma-dialectics (van Eemeren & Grootendorst): an argument must address the standpoints that have been advanced in the discussion, not merely assert its own thesis.',
  },
  counterargWhy: {
    plain:    'The epistemic basis on which a rational, well-informed interlocutor would find the opposing position compelling — the reasons that make principled dissent intelligible, not merely the social fact that dissent exists.',
    pedigree: 'Distinguishes steelmanning from devil\'s advocacy: the goal is not merely to articulate an opposing view but to reconstruct the reasons that would lead a rational agent to hold it (Walton, Informal Logic; Rawls\'s principle of charity).',
  },
  toulminClaim: {
    plain:    'The argument\'s principal propositional target — the conclusion all supporting elements are marshalled to establish; the proposition whose acceptance constitutes argumentative success.',
    pedigree: 'Toulmin, The Uses of Argument (1958): the claim is the first element of the model, logically and rhetorically prior to all other elements which exist in service of it.',
  },
  toulminGrounds: {
    plain:    'The evidentiary basis of the argument — the data, facts, statistics, or examples offered in direct support of the claim; the argument\'s empirical or factual foundation.',
    pedigree: 'Toulmin\'s "grounds" (also "data"): the second element of the model, providing the raw material from which the warrant licenses the inference to the claim.',
  },
  toulminWarrant: {
    plain:    'The inference-licensing principle connecting grounds to claim — the suppressed major premise that, if denied, defeats the argument; often the argument\'s most contestable element.',
    pedigree: 'Toulmin\'s "warrant": the third and most philosophically important element of the model, corresponding to the major premise of a syllogism; field-dependent and often the site of deepest disagreement.',
  },
  diffRemoved: {
    plain:    'Logical or rhetorical defects identified in the earlier version that are absent in the revised text — evidence of argumentative repair between drafts.',
    pedigree: 'Differential analysis of argumentative defects between revisions; a reduction in findings indicates the revision successfully addressed structural weaknesses identified in the prior analysis.',
  },
  diffAdded: {
    plain:    'Defects present in the revision but absent in the earlier version — evidence that revision introduced new logical or rhetorical liabilities not present in the original.',
    pedigree: 'New findings in a revision can indicate that changes introduced unintended inferential or rhetorical problems; revision does not necessarily improve argumentative quality on all dimensions simultaneously.',
  },
  diffPersisted: {
    plain:    'Defects common to both versions — argumentative problems the revision has not yet addressed, persisting across the full revision cycle.',
    pedigree: 'Persisting findings identify the structural problems most resistant to revision; they represent the argument\'s load-bearing weaknesses rather than surface-level issues.',
  },
  modalScopeChecks: {
    plain:    'Identification of modal inflation — cases where the argument shifts from epistemic possibility (◇p) to epistemic necessity (□p) without providing the additional warrant that would license that upgrade, or where probability language in premises is silently absent from conclusions.',
    pedigree: 'Modal logic (Kripke semantics, 1959–63) distinguishes the accessibility relation for necessity from that for possibility; in epistemic contexts (Hintikka, Knowledge and Belief, 1962), a claim that p is necessary is far stronger than a claim that p is possible. The rhetorical exploitation of this difference — presenting possible outcomes as necessary — is a form of modal fallacy documented in informal logic (Woods & Walton, 1989) and closely related to the fallacy of affirming the consequent when applied to probabilistic conditionals.',
  },

  structuralValidity: {
    plain:    'Assessment of deductive validity: does the argument\'s logical form guarantee that the truth of the premises entails the truth of the conclusion? The argument is formalised into symbolic notation and evaluated for structural entailment independently of propositional content.',
    pedigree: 'Aristotle\'s Prior Analytics (c. 350 BCE) established the validity/soundness distinction; the modern model-theoretic treatment derives from Tarski ("The Concept of Truth in Formalized Languages", 1936) and Gentzen\'s natural deduction (1935). An argument is valid iff every model satisfying the premises also satisfies the conclusion; it is invalid iff there exists a countermodel.',
  },
  validityVerdictValid: {
    plain:    'Deductively valid: in every model in which the premises are true, the conclusion is true. The argument\'s form is truth-preserving under all interpretations.',
    pedigree: 'Model-theoretic validity (Tarski, 1936): Γ ⊨ φ iff every model satisfying all members of Γ also satisfies φ. Equivalently, under Gentzen\'s proof-theoretic characterisation, Γ ⊢ φ iff there exists a derivation of φ from Γ using only structural rules and the introduction/elimination rules of the logical constants.',
  },
  validityVerdictInvalid: {
    plain:    'Deductively invalid: there exists a countermodel — a logically possible interpretation in which every premise is true and the conclusion is false. The argument\'s form is not truth-preserving.',
    pedigree: 'Invalidity is the denial of model-theoretic entailment: ∃M such that M ⊨ Γ and M ⊭ φ. The countermodel method is the standard technique for demonstrating invalidity in first-order logic (Chang & Keisler, Model Theory, 1973).',
  },
  validityVerdictInductive: {
    plain:    'Inductively strong: the premises confer high probability on the conclusion without entailing it. The argument is ampliative — the conclusion goes beyond what the premises deductively guarantee.',
    pedigree: 'Hume\'s problem of induction (A Treatise of Human Nature, 1739) established that no finite set of observations deductively entails a universal generalisation. Modern treatments: Carnap\'s inductive logic (Logical Foundations of Probability, 1950), Bayesian confirmation theory (Howson & Urbach, Scientific Reasoning, 1989).',
  },
  validityVerdictEnthymematic: {
    plain:    'Enthymematic: the argument as stated is invalid but becomes valid with the addition of specific identifiable suppressed premises. The assessment reports each suppressed premise, its structural role, and whether it is prima facie plausible.',
    pedigree: 'Aristotle, Rhetoric I.2 (c. 350 BCE): the enthymeme is a "rhetorical syllogism" with one or more premises suppressed because the audience is expected to supply them. Identifying enthymematic structure is the central task of informal logic (Walton, Fundamentals of Critical Argumentation, 2006) — most real arguments are enthymematic, and the suppressed premises are often the most contestable elements.',
  },
  validityVerdictIndeterminate: {
    plain:    'Formally indeterminate: the argument\'s logical structure cannot be formalised with sufficient confidence due to scope ambiguity, vague predicates, or underspecified logical connectives in the natural-language source.',
    pedigree: 'Natural language introduces systematic ambiguity into logical formalisation: scope ambiguities (Russell, "On Denoting", 1905), vague predicates (Williamson, Vagueness, 1994), and pragmatic underspecification of logical constants (Grice, "Logic and Conversation", 1975). The indeterminate verdict acknowledges formalisation limits rather than forcing a spurious precision.',
  },

  citationAudit: {
    plain:    'Automated verification of citations against their source documents: each factual claim with a URL is checked against the fetched source to determine whether the source actually supports the claim as stated.',
    pedigree: 'Operationalises the editorial standard of source verification — a core discipline in academic and journalistic practice — by fetching cited URLs and applying LLM-based claim–source comparison at inference speed.',
  },
  citationVerdictWell: {
    plain:    'The cited source clearly and directly supports this claim: the relevant fact, statistic, or statement is present in the source with sufficient specificity to constitute genuine evidential support.',
    pedigree: 'Strong citation alignment: the claim\'s propositional content is instantiated in the source text, satisfying the evidential requirement that a citation establish what it is cited for.',
  },
  citationVerdictWeak: {
    plain:    'The cited source is relevant to the topic but does not fully back the specific claim — it may be thematically related, partially supportive, or the claim goes beyond what the source establishes.',
    pedigree: 'Weak citation alignment: the source provides context but insufficient specificity to establish the claim\'s quantitative, causal, or temporal assertion; the claim over-extends the source\'s evidential warrant.',
  },
  citationVerdictMismatch: {
    plain:    'The source contradicts the claim or says something materially different from what the draft attributes to it — this is the highest-priority finding and requires revision before publication.',
    pedigree: 'Citation–claim mismatch: a propositional inconsistency between the claim as stated and the source content, constituting a factual error in attribution regardless of whether the source itself is reliable.',
  },
  citationVerdictUncited: {
    plain:    'This factual claim about the state of the world is presented without a cited source, leaving it unverifiable by readers.',
    pedigree: 'Uncited factual assertion: in academic and journalistic practice, empirical claims require attribution to a verifiable source; absence of citation shifts the burden of proof to the author.',
  },
  citationVerdictUnfetchable: {
    plain:    'The citation URL exists but the source could not be retrieved for automated verification — it may be paywalled, removed (404), or experiencing a network error.',
    pedigree: 'Citation retrieval failure: automated verification was not possible due to access restrictions or availability issues; the citation may still be valid but cannot be checked programmatically.',
  },

  // Tone and rhetorical posture
  tonePosture: {
    plain:    'Analysis of rhetorical posture (the stance the writer constructs through the text) and tonal register (the emotional temperature of the prose). Distinct from content analysis: posture and register describe HOW the argument addresses its audience, not WHAT it argues.',
    pedigree: 'Aristotle\'s Rhetoric (c. 350 BCE) established the tripartite analysis of persuasive appeals: ethos (character of the speaker), pathos (emotional state of the audience), logos (the argument itself). Kenneth Burke\'s dramatistic pentad (A Grammar of Motives, 1945) extends this to the "attitude" — the manner of the act. The posture-register distinction maps to Wayne Booth\'s "implied author" (The Rhetoric of Fiction, 1961) and Halliday\'s register theory in systemic functional linguistics (Language as Social Semiotic, 1978).',
  },
  postureLabel: {
    plain:    'Rhetorical posture: the implicit role the writer constructs for themselves and their audience through the text\'s structure, diction, and framing — authoritative, adversarial, conciliatory, pedagogical, confessional, ironic, prophetic, detached, or mixed.',
    pedigree: 'Aristotle\'s ethos in the Rhetoric is the character the speaker constructs through the speech itself. Perelman & Olbrechts-Tyteca (The New Rhetoric, 1958) extend this to the "universal audience" — the audience the speaker implicitly constructs as their ideal interlocutor.',
  },
  registerLabel: {
    plain:    'Tonal register: the emotional temperature and cadence of the prose — measured, urgent, indignant, sardonic, earnest, clinical, elegiac, or polemic. Register is independent of posture: a writer can be authoritative-and-measured or authoritative-and-urgent.',
    pedigree: 'Halliday\'s register theory (Language as Social Semiotic, 1978): tenor (the social relationship between interactants) determines register. In argumentative writing, register choice affects which cognitive-affective response the reader activates, shaping receptivity to the logical content (Petty & Cacioppo, Elaboration Likelihood Model, 1986).',
  },
  tonalMovesLabel: {
    plain:    'Tonal moves: specific passages where rhetorical technique does argumentative work — where the way something is said substitutes for, amplifies, or undermines the logical content.',
    pedigree: 'Perelman & Olbrechts-Tyteca\'s concept of "presence" (The New Rhetoric, 1958): techniques that make certain elements more salient to consciousness, affecting which premises receive emphasis. Each tonal move is assessed for severity (how much the rhetoric substitutes for argument) and confidence (how likely the move is deliberate).',
  },
  audiencePositionLabel: {
    plain:    'Audience position: how the text implicitly casts its reader — as expert, student, juror, ally, witness, or opponent.',
    pedigree: 'Wolfgang Iser\'s "implied reader" (The Implied Reader, 1974; The Act of Reading, 1978): the text constructs a reader-role that the actual reader is invited to inhabit. The fit between implied and actual reader determines how persuasive the text feels.',
  },

  // Evidence-weighted likelihood
  evidenceWeighted: {
    plain:    'Evidence-weighted likelihood assessment: for each empirical claim extracted from the argument, the Semantic Scholar academic corpus is queried and the degree of scientific consensus is synthesised. Non-empirical claims (normative, definitional, predictive) are classified as such and explicitly excluded from confidence estimation.',
    pedigree: 'Operationalises the is–ought distinction (Hume, A Treatise of Human Nature, 1739) and Moore\'s open question argument (Principia Ethica, 1903): only claims with empirical truth conditions receive evidence-weighted confidence. Integration via Semantic Scholar Academic Graph API (Kinney et al., "The Semantic Scholar Open Data Platform", arXiv:2301.10140, 2023) providing access to 200M+ papers with citation metadata.',
  },
  consensusStrongSupport: {
    plain:    'Strong scientific consensus in support: ≥80% of relevant literature supports the claim, with consistent findings across independent research groups and methodologies.',
    pedigree: 'Strong consensus: convergent evidence across multiple independent studies, analogous to IPCC "very high confidence" (≥90% probability) or Cochrane "high quality" evidence classification.',
  },
  consensusModerateSupport: {
    plain:    'Moderate scientific consensus in support: 55–79% of relevant papers support the claim, with some notable dissent or methodological controversy.',
    pedigree: 'Moderate consensus: the preponderance of evidence supports the claim but meaningful counter-evidence exists; analogous to IPCC "medium confidence" or Cochrane "moderate quality" evidence.',
  },
  consensusContested: {
    plain:    'Actively contested in the literature: evidence is roughly balanced or significant methodological disagreement prevents convergence. This is the honest assessment — the field has not reached consensus.',
    pedigree: 'Contested: the literature exhibits genuine Duhemian underdetermination (Duhem, The Aim and Structure of Physical Theory, 1906) — the available evidence is compatible with multiple interpretations. Forcing a consensus estimate on genuinely contested evidence would violate the epistemic norm of proportioning belief to evidence (Locke, Essay Concerning Human Understanding, 1689).',
  },
  consensusModerateOpposition: {
    plain:    'Moderate scientific consensus opposing the claim: 55–79% of relevant papers contradict or fail to support it.',
    pedigree: 'Moderate opposition: the weight of evidence leans against the claim, though it retains some empirical support.',
  },
  consensusStrongOpposition: {
    plain:    'Strong scientific consensus against the claim: ≥80% of relevant research contradicts it. The scientific mainstream decisively rejects this position.',
    pedigree: 'Strong opposition: convergent evidence against the claim across multiple independent research programs; the position is rejected by the epistemic community as currently constituted.',
  },
  consensusInsufficient: {
    plain:    'Insufficient empirical data: fewer than 3 relevant papers found, or the retrieved papers do not bear directly on this specific claim. This is not evidence against the claim — it is an absence of assessable evidence.',
    pedigree: 'Absence of evidence is not evidence of absence (Altman & Bland, "Absence of evidence is not evidence of absence", BMJ 311:485, 1995). The claim may be well-supported by evidence not indexed in Semantic Scholar, or may be too domain-specific for the corpus to cover.',
  },
  consensusNotApplicable: {
    plain:    'Not empirically assessable: this claim is a value judgment, a definition, or a prediction about the future — not a factual assertion that existing research can verify or falsify. Assigning a confidence percentage would be misleading.',
    pedigree: 'The is–ought gap (Hume, A Treatise of Human Nature III.i.1, 1739): "In every system of morality which I have hitherto met with, I have always remarked that the author proceeds for some time in the ordinary way of reasoning... when of a sudden I am surprised to find that instead of the usual copulations of propositions, is and is not, I meet with no proposition that is not connected with an ought or an ought not." Moore\'s naturalistic fallacy (Principia Ethica, 1903) extends this: no empirical property is identical with the evaluative property "good." Confidence percentages are categorically inapplicable to such claims.',
  },
} satisfies { [K in keyof typeof TOOLTIPS_PLAIN]: { plain: string; pedigree: string } };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getLabels(preference?: TerminologyPreference): { readonly [K in keyof typeof LABELS_PLAIN]: string } {
  return preference === 'formal' ? LABELS_FORMAL : LABELS_PLAIN;
}

export function getTooltips(preference?: TerminologyPreference): { readonly [K in keyof typeof TOOLTIPS_PLAIN]: { plain: string; pedigree: string } } {
  return preference === 'formal' ? TOOLTIPS_FORMAL : TOOLTIPS_PLAIN;
}

// ---------------------------------------------------------------------------
// Backward-compat re-exports (existing imports continue to work)
// ---------------------------------------------------------------------------

export const LABELS = LABELS_PLAIN;
export const TOOLTIPS = TOOLTIPS_PLAIN;
