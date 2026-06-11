import { structural } from '../../../functions/_lib/grounded/types';
import type { Sample } from './types';

const TEXT = `A recent observational study of 1,247 adults found that participants who consumed at least one serving of dark leafy greens per day exhibited a 23% lower incidence of cognitive decline over a five-year follow-up period. These findings suggest that dark leafy greens may be neuroprotective and should be incorporated into dietary guidelines for older adults.

The study controlled for age, sex, and education level. Participants were recruited from a single metropolitan area through community health screening events. Of the 1,800 initially enrolled, those who completed all five years of follow-up (n=1,247) formed the analytic sample. Cognitive decline was measured using a standardised screening battery administered annually.

Given the robustness of the effect size and the biological plausibility of the mechanism (high concentrations of folate, vitamin K, and lutein in leafy greens), public-health authorities should update their recommendations to specifically emphasise daily leafy green consumption. The case for action is clear, even if some uncertainty remains about the precise mechanism. Waiting for definitive randomised controlled trial evidence would mean accepting preventable cognitive decline in a population that could benefit now.`;

export const STUDY_ABSTRACT_SAMPLE: Sample = {
  id:           'study-abstract',
  title:        'Leafy greens and cognitive decline',
  category:     'Pseudo-scientific abstract',
  shortLabel:   'Study abstract',
  failureModes: ['selection bias', 'base-rate neglect', 'modal inflation', 'unstated methodological warrants'],
  text:         TEXT,
  cached: {
    audit: {
      centralClaim: 'Dietary guidelines should be updated to emphasise daily leafy green consumption.',
      toulmin: {
        claim:         'Public-health authorities should update dietary recommendations to emphasise daily leafy green consumption.',
        grounds:       'An observational study found a 23% lower incidence of cognitive decline among participants who consumed at least one daily serving over a five-year follow-up.',
        statedWarrant: 'High concentrations of folate, vitamin K, and lutein in leafy greens provide a biologically plausible mechanism.',
        unstatedWarrants: [
          {
            warrant:    'Associations from a single observational study controlling for only three confounders are sufficient grounds for population-level policy change.',
            necessity:  'Without this premise the leap from "23% lower incidence in this sample" to "update national dietary guidelines" cannot be justified — the cited evidence supports a hypothesis worth testing, not a policy worth adopting.',
            severity:   'high',
            groundedness: structural(), _debugConfidence: 92,
          },
          {
            warrant:    'The 547 participants who dropped out of the five-year follow-up are statistically similar to those who remained.',
            necessity:  'The 30% loss-to-follow-up rate is large enough that differential dropout (e.g., participants experiencing cognitive decline drop out earlier) could substantially bias the observed effect. The argument silently assumes attrition was random.',
            severity:   'high',
            groundedness: structural(), _debugConfidence: 86,
          },
        ],
        weakestLink: 'The argument treats one observational study with significant methodological limitations (single recruitment site, 30% attrition, limited confounder control) as adequate basis for changing public-health guidance — a leap the cited evidence does not support.',
      },
      namedFallacies: [
        {
          name:        'Selection Bias',
          quote:       'Participants were recruited from a single metropolitan area through community health screening events',
          explanation: 'Self-selection into community health screenings systematically over-represents health-conscious adults — exactly the population most likely to consume leafy greens AND most likely to engage in other protective behaviours. The 23% effect may be confounded by unmeasured lifestyle factors.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 88,
        },
        {
          name:        'Hasty Generalisation',
          quote:       'public-health authorities should update their recommendations to specifically emphasise daily leafy green consumption',
          explanation: 'Generalises from one observational study, one population, one geographic context to a global guideline-update recommendation. The pattern from one sample is treated as a population law.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 85,
        },
        {
          name:        'Argument from Ignorance',
          quote:       'Waiting for definitive randomised controlled trial evidence would mean accepting preventable cognitive decline',
          explanation: 'Treats the absence of disconfirming RCT evidence as licence to act — but the leafy-green hypothesis has not yet been positively confirmed by RCT either. The framing inverts the burden of proof for the policy intervention.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 78,
        },
      ],
      loadedLanguage: [
        {
          phrase:      'The case for action is clear',
          technique:   'Weasel words',
          explanation: 'Asserts clarity to forestall further inspection of the evidence base. The phrase performs certainty rather than demonstrating it.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 80,
        },
      ],
      notes: null,
      keyTermScrutiny: [],
      referentChecks: [
        {
          phrase:      'public-health authorities',
          issue:       'vague-proper-name',
          explanation: 'Which public-health authorities? National (NHS, CDC, WHO)? Local? Professional bodies? The recommendation has no specified target, which obscures the question of whether any specific body has the evidential standards this argument actually satisfies.',
          evidence:    'public-health authorities should update their recommendations',
          severity:    'low',
          groundedness: structural(), _debugConfidence: 70,
        },
      ],
      falsifiabilityChecks: [],
      modalScopeChecks: [
        {
          claim:         'Effect described as both suggestive and policy-actionable simultaneously',
          inflatedModal: 'should be incorporated into dietary guidelines',
          impliedModal:  'warrants further confirmatory research before incorporation into guidelines',
          issue:         'hedge-stripped-in-conclusion',
          explanation:   'The premise uses "may be neuroprotective" — appropriate hedging for observational data. The conclusion drops the hedge and asserts "should be incorporated" — a policy prescription. The hedge cannot be silently stripped at the conclusion step.',
          evidence:      'These findings suggest that dark leafy greens may be neuroprotective and should be incorporated into dietary guidelines for older adults.',
          severity:      'high',
          groundedness: structural(), _debugConfidence: 87,
        },
      ],
    },
    extraction: {
      centralClaim: 'Public-health authorities should update dietary guidelines to emphasise daily leafy green consumption.',
      statements: [
        { id: 'P1', type: 'premise', text: 'A five-year observational study of 1,247 adults found 23% lower incidence of cognitive decline among daily leafy green consumers.', claimType: 'empirical_contested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P2', type: 'premise', text: 'Leafy greens contain high concentrations of folate, vitamin K, and lutein.', claimType: 'empirical_uncontested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P3', type: 'premise', text: '★ Observational findings with biologically plausible mechanisms are sufficient grounds for guideline updates.', claimType: 'normative', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P4', type: 'premise', text: '★ The 30% follow-up attrition does not materially bias the observed effect.', claimType: 'empirical_contested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'C1', type: 'conclusion', text: 'Daily leafy green consumption is causally protective against cognitive decline.', claimType: 'empirical_contested', derivedFrom: ['P1', 'P2'], inferenceRule: 'abduction', inferenceRuleExplanation: 'The biological mechanism (P2) is invoked to bridge the observational association (P1) to a causal claim — abductive inference to best explanation.' },
        { id: 'C2', type: 'conclusion', text: 'Dietary guidelines should be updated to emphasise daily leafy green consumption.', claimType: 'normative', derivedFrom: ['C1', 'P3', 'P4'], inferenceRule: 'modus_ponens', inferenceRuleExplanation: 'The causal claim (C1) combined with the implicit normative premise (P3) and methodological assumption (P4) yields the policy conclusion.' },
      ],
      notes:      'P3 and P4 are implicit (★) — the argument depends on both but does not state either. C1 makes a causal claim that the cited study (observational, single site, 30% attrition) cannot establish on its own; the abductive leap is doing significant work.',
      groundedness: { kind: "interpretive" as const, band: "medium" as const }, _debugConfidence: 84,
    },
  },
};
