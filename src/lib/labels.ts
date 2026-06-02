// User-facing labels for analytical concepts.
// Code, schemas, prompts, and database fields use their precise technical names.
// THIS FILE controls only what appears on user-visible UI surfaces.

export type TerminologyPreference = 'plain' | 'formal';

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
  commitmentsEpistemic:        'Epistemic Stance',
  commitmentsPolitical:        'Political Framework',
  commitmentsMethodological:   'Methodological Approach',
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
