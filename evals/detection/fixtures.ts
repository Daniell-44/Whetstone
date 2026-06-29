// Seed fixtures for the detection eval. Each names the fallacies the engine
// SHOULD emit (verbatim from FALLACY_NAMES); an empty list is an *adversarial
// clean* passage — legitimate reasoning the engine should leave alone. The
// clean cases matter most: over-detection (false positives) is the documented
// #1 failure mode, so half the seed set is designed to trip a trigger-happy
// detector. Grow this toward ~50 (5–7/week), keeping the clean:dirty balance.

export interface DetectionFixture {
  id:                string;
  text:              string;
  expectedFallacies: string[]; // [] = should produce no named fallacy
  notes?:            string;
}

export const DETECTION_FIXTURES: DetectionFixture[] = [
  // --- Clear fallacies (recall) ---
  {
    id: 'det-authority',
    text: 'We should adopt the new diet immediately. A celebrity fitness influencer with millions of followers swears by it, and that is good enough for me.',
    expectedFallacies: ['Appeal to Authority'],
    notes: 'Influencer is not a domain expert; no underlying evidence offered.',
  },
  {
    id: 'det-false-dichotomy',
    text: 'Either we ban phones in every school completely, or we accept that an entire generation will grow up unable to concentrate. There is no middle path.',
    expectedFallacies: ['False Dichotomy'],
    notes: 'Regulation, age-gating, partial bans are unacknowledged middle options.',
  },
  {
    id: 'det-ad-hominem',
    text: "My opponent's argument for the housing levy can be dismissed out of hand. He is a landlord himself, so of course he would say that.",
    expectedFallacies: ['Ad Hominem'],
    notes: 'Dismisses the argument via the arguer\'s circumstance, not its content.',
  },
  {
    id: 'det-posthoc-slippery',
    text: 'Ever since the council installed the cycle lanes, high-street sales have fallen — the lanes are clearly killing local business. And if we do not rip them out now, soon there will be no shops left on the street at all.',
    expectedFallacies: ['Post Hoc', 'Slippery Slope'],
    notes: 'Causation from sequence, then an ungrounded chain to an extreme outcome.',
  },

  // --- Adversarial clean (precision / over-detection) ---
  {
    id: 'det-clean-legit-authority',
    text: 'The cardiologist who reviewed the trial — a specialist in the relevant field, with no industry funding — concluded the drug lowers cardiac risk, a finding echoed by the broader consensus of cardiologists.',
    expectedFallacies: [],
    notes: 'A LEGITIMATE appeal to authority: relevant expert, no conflict, consensus. A trigger-happy detector wrongly flags Appeal to Authority.',
  },
  {
    id: 'det-clean-hedged',
    text: 'The early data suggest a modest association between the policy and lower emissions, though the sample is small and the authors caution against drawing any firm causal conclusion.',
    expectedFallacies: [],
    notes: 'Properly hedged empirical claim; no overreach to flag.',
  },
  {
    id: 'det-clean-valid-conditional',
    text: "If the bridge's load tolerance is below the regulation threshold, it must be closed for repair. The latest inspection puts it below that threshold. So it should be closed.",
    expectedFallacies: [],
    notes: 'Valid modus ponens — no fallacy.',
  },
  {
    id: 'det-clean-tradeoff',
    text: 'Raising the levy would fund the programme but also burden small firms. On balance the revenue gain outweighs that cost, given the targeted relief carved out for the smallest businesses.',
    expectedFallacies: [],
    notes: 'A balanced normative trade-off that acknowledges the downside; nothing fallacious.',
  },

  // --- Clear fallacies, batch 2 (recall; gold labels need Daniel's review) ---
  {
    id: 'det-straw-man',
    text: 'Those who want any gun regulation at all are really arguing that families should not be allowed to defend themselves — a position almost no one actually holds.',
    expectedFallacies: ['Straw Man'],
    notes: 'Recasts "any regulation" as "no self-defence", attacking a position no one took.',
  },
  {
    id: 'det-hasty-generalisation',
    text: 'I have met three rude people from that city, so the people there are rude.',
    expectedFallacies: ['Hasty Generalisation'],
    notes: 'Sweeping conclusion from a tiny sample.',
  },
  {
    id: 'det-circular',
    text: 'The president is trustworthy because he says he is, and an honest man would never lie about being trustworthy.',
    expectedFallacies: ['Circular Reasoning'],
    notes: 'The conclusion (trustworthy) is assumed in the premise.',
  },
  {
    id: 'det-no-true-scotsman',
    text: 'No genuine socialist would support that policy. The party leader supports it — so he is not a genuine socialist.',
    expectedFallacies: ['No True Scotsman'],
    notes: 'Redefines the category to exclude the counter-example.',
  },
  {
    id: 'det-cherry-picking',
    text: 'Of the ten trials on the drug, the brochure cites only the two that found a benefit and omits the rest.',
    expectedFallacies: ['Cherry-Picking'],
    notes: 'Selects only the favourable items from an available evidence base.',
  },
  {
    id: 'det-tu-quoque',
    text: 'The doctor told me to lose weight, but she is overweight herself, so I will ignore the advice.',
    expectedFallacies: ['Tu Quoque'],
    notes: 'Deflects the advice by pointing at the adviser.',
  },
  {
    id: 'det-equivocation',
    text: 'The sign said it is fine to park here, and a fine is a punishment, so parking here gets you punished.',
    expectedFallacies: ['Equivocation'],
    notes: 'Slides between two senses of "fine".',
  },

  // --- Adversarial clean, batch 2 (precision / over-detection baits) ---
  {
    id: 'det-clean-grounded-slippery',
    text: 'If we miss this payment the account goes to collections, which lowers our credit score, which raises our borrowing costs next quarter — each step is spelled out in the contract.',
    expectedFallacies: [],
    notes: 'A supported causal chain with a stated mechanism — NOT a slippery slope. Baits over-detection.',
  },
  {
    id: 'det-clean-valid-disjunction',
    text: 'The package is either still at the depot or already out for delivery. It is not at the depot, so it is out for delivery.',
    expectedFallacies: [],
    notes: 'Valid disjunctive syllogism — no fallacy.',
  },
  {
    id: 'det-clean-normative',
    text: 'We ought to treat the patients in the most pain first, because relieving severe suffering matters more than easing minor discomfort.',
    expectedFallacies: [],
    notes: 'A value argument; normative, not fallacious. Should not be flagged.',
  },
  {
    id: 'det-clean-qualified-generalisation',
    text: 'In our three trials, and consistent with the larger published studies we cite, the treatment reduced symptoms; we therefore expect a modest benefit, pending the ongoing trial.',
    expectedFallacies: [],
    notes: 'Properly qualified and cites larger evidence — not a hasty generalisation. Baits over-detection.',
  },
  {
    id: 'det-clean-bias-flag',
    text: 'Before trusting the safety report, note it was written by the manufacturer\'s own lab — a reason to seek independent verification, not to dismiss it outright.',
    expectedFallacies: [],
    notes: 'Legitimate conflict-of-interest flagging that explicitly does NOT dismiss the claim — NOT ad hominem. Baits over-detection.',
  },
  {
    id: 'det-clean-concession',
    text: 'The policy has real costs for small firms, and I do not dismiss that. But the targeted relief offsets most of it, so on balance it is worth doing.',
    expectedFallacies: [],
    notes: 'Acknowledges the downside; balanced reasoning, nothing fallacious.',
  },
  {
    id: 'det-clean-good-analogy',
    text: 'The accounts were checked line by line by an independent auditor and passed every test, so we can rely on them for the forecast.',
    expectedFallacies: [],
    notes: 'Support is the audit itself, not rhetoric — should not be flagged.',
  },

  // ===========================================================================
  // Batch 3 (2026-06-29) — research-grounded expansion toward ~50.
  // *** GOLD LABELS PENDING DANIEL'S RATIFICATION. ***
  // Design (from the fallacy-eval literature: MAFALDA, Missci, "models learn
  // datasets not arguments" 2505.22137, Gardner contrast-sets, Walton/Boudry):
  //   • 10 MINIMAL PAIRS — each clean+dirty share topic/length/wording and
  //     differ only in argument structure (one Walton critical question
  //     passes vs fails). A surface-cue detector can't get both right, so the
  //     pair is an anti-shortcut probe (report per-pair consistency).
  //   • 8 STANDALONE — cover types the first 22 never tested + hard/implicit
  //     cases. Registers spread across science-comms / Reddit-CMV / op-ed /
  //     political speech / academic / conversational, with fallacy types
  //     crossed against registers (so the label can't be read off the domain).
  //   • Notes tag [register · difficulty] and give a ratifiable rationale:
  //     scheme · critical-question at issue · why pass/fail · the surface cue
  //     that might mislead a detector but is irrelevant here.
  //   • Matcher is single-label; where a second label is defensible it's noted
  //     as "acceptable alt" for Daniel to rule on (and motivates a future
  //     alternate-label matcher).
  // ===========================================================================

  // --- Pair 1 · Appeal to Authority · science comms ---
  {
    id: 'det-clean-auth-infield',
    text: 'A panel of practising oncologists, summarising the pooled results of the registered screening trials, concluded the programme cuts late-stage diagnoses; none of the panel reported industry funding.',
    expectedFallacies: [],
    notes: '[science-comms · hard] Argument from expert opinion, CQ satisfied: relevant in-field experts, consensus, no conflict, and underlying trial evidence. Surface cue "a panel concluded" mimics appeal-to-authority but the inference is sound.',
  },
  {
    id: 'det-auth-outfield',
    text: 'A Nobel laureate in physics says the cancer-screening programme is worthless, and a mind that brilliant is not one to bet against, so we should scrap it.',
    expectedFallacies: ['Appeal to Authority'],
    notes: '[science-comms · medium] Argument from expert opinion, CQ fails: expertise is out-of-field (physics, not oncology) and stands in for evidence. Minimal-pair twin of det-clean-auth-infield.',
  },

  // --- Pair 2 · Appeal to Authority · Reddit/CMV ---
  {
    id: 'det-clean-auth-consensus',
    text: "Pretty much every climate scientist who actually runs the models agrees the warming is human-driven, so I'll weight that consensus over a single blog post.",
    expectedFallacies: [],
    notes: '[reddit-cmv · medium] Appeal to relevant expert consensus — legitimate. Surface cues ("every scientist agrees") look like a bandwagon/authority bait but the appeal is to the right experts on their own subject.',
  },
  {
    id: 'det-auth-maverick',
    text: "One contrarian professor emeritus disputes the climate consensus, and that one expert's say-so is good enough for me to dismiss the whole field.",
    expectedFallacies: ['Appeal to Authority'],
    notes: '[reddit-cmv · hard] Argument from expert opinion, CQ fails: leans on a lone dissenting authority against the consensus, with the say-so doing the evidentiary work. Acceptable alt: Cherry-Picking. Minimal-pair twin of det-clean-auth-consensus.',
  },

  // --- Pair 3 · Slippery Slope · op-ed ---
  {
    id: 'det-clean-slope-mechanism',
    text: 'Cutting the ferry subsidy raises ticket prices, which the operator has already stated would force it to drop the two least-used weekend sailings — a single, documented consequence, not a parade of horribles.',
    expectedFallacies: [],
    notes: '[op-ed · hard] A bounded causal step with a stated mechanism and source — NOT a slippery slope. Baits over-detection on the "cutting X leads to Y" surface frame.',
  },
  {
    id: 'det-slope-doom',
    text: 'If we let the council cut even one ferry sailing, before long the whole island will be cut off, the school will be forced to close, and the village will die out entirely.',
    expectedFallacies: ['Slippery Slope'],
    notes: '[op-ed · easy] Ungrounded escalation from one cut to civilisational collapse, no mechanism for the intermediate steps. Minimal-pair twin of det-clean-slope-mechanism.',
  },

  // --- Pair 4 · Post Hoc · health/science ---
  {
    id: 'det-clean-cause-mechanism',
    text: 'Flu cases fell the winter after the new vaccine rolled out; given high uptake and a known immune mechanism, the authors attribute much of the drop to it, while noting the milder weather likely helped too.',
    expectedFallacies: [],
    notes: '[health · hard] Causal claim with a mechanism and an explicitly acknowledged confounder — not a bare post hoc. Baits over-detection on the "X then Y fell" frame.',
  },
  {
    id: 'det-posthoc-bare',
    text: 'I started taking the herbal supplement in October and my cold cleared up a week later, so the supplement is what cured it.',
    expectedFallacies: ['Post Hoc'],
    notes: '[conversational · easy] Causation inferred from mere temporal sequence; colds resolve on their own. Minimal-pair twin of det-clean-cause-mechanism.',
  },

  // --- Pair 5 · Ad Hominem · political debate ---
  {
    id: 'det-clean-coi-flag',
    text: "The think-tank's report backing the merger is worth reading, but note it is funded by the acquiring firm — a reason to check its figures against independent ones, not to set it aside.",
    expectedFallacies: [],
    notes: '[political-debate · hard] Legitimate conflict-of-interest flag that explicitly does NOT dismiss the argument — a sound appeal to bias, not ad hominem. Baits over-detection (mentions the source unfavourably).',
  },
  {
    id: 'det-adhom-abuse',
    text: "You can throw out the think-tank's report backing the merger — it is run by exactly the kind of out-of-touch elitists who have never run a real business.",
    expectedFallacies: ['Ad Hominem'],
    notes: '[political-debate · easy] Abuse of the source substitutes for engaging the report. Minimal-pair twin of det-clean-coi-flag (same source/topic, label flips on whether the argument is actually addressed).',
  },

  // --- Pair 6 · Hasty Generalisation · conversational ---
  {
    id: 'det-clean-sample-adequate',
    text: 'We surveyed a random 1,200 customers spread across every region and 70% wanted Sunday opening, so we are fairly confident a majority of customers do.',
    expectedFallacies: [],
    notes: '[conversational · medium] Generalisation from an adequate, representative, randomly-sampled base — sound. Baits over-detection on the "we asked customers, so customers want X" frame.',
  },
  {
    id: 'det-hasty-n1',
    text: 'The one customer I happened to chat with this morning wanted Sunday opening, so clearly our customers want us open on Sundays.',
    expectedFallacies: ['Hasty Generalisation'],
    notes: '[conversational · easy] Sweeping conclusion from a single, self-selected case. Minimal-pair twin of det-clean-sample-adequate.',
  },

  // --- Pair 7 · Straw Man · op-ed ---
  {
    id: 'det-clean-fair-restatement',
    text: 'Supporters of the basic-income trial argue it would cut administrative complexity and ease the poverty trap; granting those aims, I still think the cost projections do not add up.',
    expectedFallacies: [],
    notes: "[op-ed · medium] Restates the opponent's position fairly before disagreeing — the opposite of a straw man. Baits over-detection on the adversarial framing.",
  },
  {
    id: 'det-strawman-distort',
    text: 'Supporters of the basic-income trial apparently believe the state should hand out free money to people who refuse to work — a fantasy the country cannot afford.',
    expectedFallacies: ['Straw Man'],
    notes: '[op-ed · medium] Recasts "a basic-income trial" as "free money for the work-shy", a position supporters did not take. Minimal-pair twin of det-clean-fair-restatement.',
  },

  // --- Pair 8 · Equivocation · academic ---
  {
    id: 'det-clean-term-consistent',
    text: "The paper calls the process 'natural' in the technical sense of occurring without human intervention, and it uses that single sense consistently throughout its argument.",
    expectedFallacies: [],
    notes: "[academic · hard] A potentially-ambiguous key term ('natural') is fixed to one sense and held there — no equivocation. Baits over-detection by foregrounding a slippery word.",
  },
  {
    id: 'det-equiv-shift',
    text: "Evolution is only a theory, and since a theory is just a hunch someone has not proven, evolution is just an unproven hunch we can set aside.",
    expectedFallacies: ['Equivocation'],
    notes: "[academic · medium] Slides 'theory' from its scientific sense (well-tested explanatory framework) to the colloquial 'guess'. Minimal-pair twin of det-clean-term-consistent (same equivocable term, opposite handling).",
  },

  // --- Pair 9 · Genetic Fallacy · Reddit/CMV ---
  {
    id: 'det-clean-origin-verified',
    text: 'The figure first appeared in a tabloid, which was reason to be wary — but after three broadsheets reproduced it from the original dataset, its tabloid origin no longer counts against it.',
    expectedFallacies: [],
    notes: '[reddit-cmv · hard] Origin is treated as a prompt to verify, not as grounds to reject, and the claim is then independently confirmed — not a genetic fallacy. Baits over-detection (disparages the source).',
  },
  {
    id: 'det-genetic',
    text: 'That economic argument originally comes from a 19th-century pamphlet, so it can be written off as outdated nonsense regardless of what it actually claims.',
    expectedFallacies: ['Genetic Fallacy'],
    notes: '[reddit-cmv · medium] Rejects the argument solely on the basis of where it came from, never engaging its content. Minimal-pair twin of det-clean-origin-verified.',
  },

  // --- Pair 10 · Composition · everyday/academic ---
  {
    id: 'det-clean-additive',
    text: 'Each of the eight carriages weighs under 40 tonnes, so the coupled train weighs under 320 tonnes — the weights simply add across the parts.',
    expectedFallacies: [],
    notes: '[academic · medium] Valid part-to-whole inference because the property (weight) is genuinely additive. Baits over-detection on the "true of each part, so true of the whole" frame that composition shares.',
  },
  {
    id: 'det-composition',
    text: 'Every player on the squad is the best in the league at their own position, so this has to be the best team in the league.',
    expectedFallacies: ['Composition'],
    notes: '[everyday · medium] Infers a whole-property (team quality) from part-properties (individual skill) for a property that is not additive — teamwork is emergent. Minimal-pair twin of det-clean-additive.',
  },

  // --- Standalone clean (3) — hard negatives covering further over-detection baits ---
  {
    id: 'det-clean-popular-practice',
    text: 'Most surgeons double-glove for this procedure; since that is the trained standard of care and the reason is documented infection control, following it here is reasonable.',
    expectedFallacies: [],
    notes: '[science-comms · hard] Appeal to a common practice that is itself justified by a stated reason — not a bandwagon/appeal-to-popularity. Baits over-detection.',
  },
  {
    id: 'det-clean-sign',
    text: 'The barometer is dropping sharply, which around here reliably precedes a storm within the day, so we pulled the boats in.',
    expectedFallacies: [],
    notes: '[conversational · hard] Argument from sign with a real, reliable correlation used predictively — not a false cause. Baits over-detection on the "X, so Y" frame.',
  },
  {
    id: 'det-clean-modal-scope',
    text: 'Some of the committee\'s proposals are unfunded; it does not follow that the committee is reckless, only that these particular items need a funding source before they proceed.',
    expectedFallacies: [],
    notes: '[op-ed · medium] Correctly scopes "some" and blocks the overgeneralisation itself — sound. Baits over-detection on hasty-generalisation surface cues.',
  },

  // --- Standalone dirty (5) — types untested by the first 22 + a hard probabilistic one ---
  {
    id: 'det-appeal-emotion',
    text: 'Picture the terrified families lying awake tonight — how dare anyone quibble over statistics when children\'s lives hang in the balance? Pass the law now.',
    expectedFallacies: ['Appeal to Emotion'],
    notes: '[political-speech · easy] Fear and indignation are made to stand in for the evidentiary question of whether the law works. Acceptable alt: Red Herring.',
  },
  {
    id: 'det-red-herring',
    text: 'You ask whether the drug actually works, but the real scandal is how much the regulator\'s executives are paid — that is what we should be talking about.',
    expectedFallacies: ['Red Herring'],
    notes: '[reddit-cmv · medium] Redirects from the efficacy question to an unrelated grievance about salaries.',
  },
  {
    id: 'det-arg-ignorance',
    text: 'No study has ever proven the additive is harmful, so it is perfectly safe to consume in any quantity you like.',
    expectedFallacies: ['Argument from Ignorance'],
    notes: '[science-comms · medium] Treats absence of evidence of harm as positive proof of safety. Surface cue ("no study has proven") could read as a sound evidential claim, but the leap to "safe in any quantity" is the tell.',
  },
  {
    id: 'det-goalposts',
    text: 'Fine, the bridge passed the load test. But have you tested it in an earthquake, a once-a-century flood, and a direct lightning strike? Until all of that is done I will not accept it is safe.',
    expectedFallacies: ['Moving the Goalposts'],
    notes: '[conversational · medium] The original standard (load test) is met, so the bar is raised to an ever-receding set of new demands.',
  },
  {
    id: 'det-base-rate',
    text: 'The screening test is 95% accurate and Priya just tested positive for the rare condition, so she almost certainly has it.',
    expectedFallacies: ['Base-Rate Neglect'],
    notes: '[health · hard] Ignores the low base rate — when the condition is rare, most positives on a 95%-accurate test are false positives. Surface cue "95% accurate" invites the wrong intuition; this is the classic probabilistic trap.',
  },
];
