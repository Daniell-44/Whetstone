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
];
