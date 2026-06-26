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
];
