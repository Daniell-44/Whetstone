import { structural } from '../../../functions/_lib/grounded/types';
import type { Sample } from './types';

const TEXT = `The case for mandatory bicycle helmets is straightforward: helmet use reduces head injuries by 60% and saves an estimated 400 lives per year in the UK. The inconvenience to cyclists is trivially small compared to this public health benefit. Those who resist the requirement are, in effect, arguing that their personal preference for helmet-free cycling outweighs hundreds of preventable deaths.

Countries that have introduced helmet laws have seen cycling injuries drop sharply. Australia's mandatory helmet law, introduced in 1991, led to a significant reduction in head injuries among cyclists. The evidence is clear and the policy implication is obvious.

Critics claim that helmet laws discourage cycling, but this objection misses the point entirely. We don't refuse to mandate seatbelts because some people might stop driving. Safety requirements are the baseline expectation in every other form of transport — cycling should be no different.

The real question isn't whether helmets work. The science is settled on that. The question is whether we value convenience over human life. Any reasonable person would choose life.`;

export const HELMETS_SAMPLE: Sample = {
  id:           'helmets',
  title:        'Mandatory bicycle helmets',
  category:     'Public policy',
  shortLabel:   'Helmets op-ed',
  failureModes: ['false dichotomy', 'appeal to emotion', 'modal inflation', 'hasty generalisation'],
  text:         TEXT,
  cached: {
    audit: {
      centralClaim: 'Mandatory bicycle helmet laws should be introduced because they save lives.',
      toulmin: {
        claim:         'Helmet laws are justified public-health policy.',
        grounds:       'Helmets reduce head injuries by 60% and Australia\'s 1991 law reduced injuries.',
        statedWarrant: null,
        unstatedWarrants: [
          {
            warrant:    'Reducing aggregate injury rates morally justifies state-mandated coercion of competent adults.',
            necessity:  'Without this premise the cited injury statistics provide no normative bridge to a legal requirement; the argument collapses into a description of helmet effectiveness, not a justification for compulsion.',
            severity:   'high',
            groundedness: structural(), _debugConfidence: 88,
          },
          {
            warrant:    'The freedoms forgone under a helmet law are comparable in kind to those forgone under seatbelt laws.',
            necessity:  'The seatbelt analogy in paragraph 3 only succeeds if the morally relevant features are equivalent. If cycling helmet-free harms primarily the cyclist while not wearing a seatbelt affects insurance claims and emergency-response load, the analogy breaks.',
            severity:   'medium',
            groundedness: structural(), _debugConfidence: 76,
          },
        ],
        weakestLink: 'The argument never establishes that aggregate injury reduction is a sufficient warrant for state coercion — it asserts the policy implication is "obvious" rather than arguing for it.',
      },
      namedFallacies: [
        {
          name:        'False Dichotomy',
          quote:       'The question is whether we value convenience over human life. Any reasonable person would choose life.',
          explanation: 'The framing reduces the choice to "convenience vs life" — collapsing the actual policy space (no law, education, infrastructure investment, age-graduated rules, voluntary uptake campaigns) to two stark options. A reasonable person could oppose the law while still valuing life.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 92,
        },
        {
          name:        'Appeal to Emotion',
          quote:       'their personal preference for helmet-free cycling outweighs hundreds of preventable deaths',
          explanation: 'Recasts opposition as preferring "personal preference" over "hundreds of preventable deaths" — language designed to make disagreement feel morally monstrous rather than principled.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 88,
        },
        {
          name:        'Hasty Generalisation',
          quote:       'Countries that have introduced helmet laws have seen cycling injuries drop sharply',
          explanation: 'A single example (Australia 1991) is offered as evidence for "countries" (plural). The pattern from one country in one decade is presented as a general law without engaging with cases where helmet laws coincided with reduced cycling overall.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 82,
        },
      ],
      loadedLanguage: [
        {
          phrase:      'trivially small',
          technique:   'Weasel words',
          explanation: 'Asserts triviality without quantifying the costs — the comparison "trivially small compared to this public health benefit" is presented as if self-evident.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 78,
        },
        {
          phrase:      'Any reasonable person would choose life',
          technique:   'Emotionally charged terms',
          explanation: 'Frames disagreement as unreasonable by definition. The rhetorical move conflates opposing the law with opposing life itself.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 90,
        },
      ],
      notes:                null,
      keyTermScrutiny:      [],
      referentChecks:       [],
      falsifiabilityChecks: [],
      modalScopeChecks: [
        {
          claim:         'The science is presented as fully settled',
          inflatedModal: 'The science is settled on that',
          impliedModal:  'The current evidence broadly supports helmet effectiveness, though policy effectiveness remains contested',
          issue:         'necessity-overstated',
          explanation:   'Substitutes "settled" — a strong modal claim — for what the cited evidence actually supports (effectiveness of helmets in reducing head injury per cyclist). The policy effectiveness (does mandating them reduce population-level harm?) is contested and depends on cycling rate effects the draft does not engage with.',
          evidence:      'The science is settled on that.',
          severity:      'high',
          groundedness: structural(), _debugConfidence: 85,
        },
      ],
    },
    extraction: {
      centralClaim: 'Mandatory bicycle helmet laws should be introduced.',
      statements: [
        { id: 'P1', type: 'premise', text: 'Helmet use reduces head injuries by approximately 60%.', claimType: 'empirical_contested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P2', type: 'premise', text: 'An estimated 400 cyclist lives per year could be saved by helmet use in the UK.', claimType: 'empirical_contested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P3', type: 'premise', text: 'Australia\'s 1991 mandatory helmet law led to a significant reduction in head injuries among cyclists.', claimType: 'empirical_contested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P4', type: 'premise', text: '★ Reducing population-level injury rates is sufficient justification for state-mandated requirements on competent adults.', claimType: 'normative', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P5', type: 'premise', text: '★ Helmet laws are analogous to seatbelt laws in the relevant moral and practical respects.', claimType: 'normative', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'C1', type: 'conclusion', text: 'Mandating helmet use would produce a net reduction in cyclist injuries.', claimType: 'modal_predictive', derivedFrom: ['P1', 'P2', 'P3'], inferenceRule: 'inductive_generalisation', inferenceRuleExplanation: 'Three injury-reduction observations are generalised to a predicted outcome of the proposed law.' },
        { id: 'C2', type: 'conclusion', text: 'Mandatory bicycle helmet laws should be introduced.', claimType: 'normative', derivedFrom: ['C1', 'P4', 'P5'], inferenceRule: 'modus_ponens', inferenceRuleExplanation: 'Granted the injury reduction (C1) and the normative principles (P4, P5), the conclusion that the law should be introduced follows.' },
      ],
      notes:      'Premises P4 and P5 are implicit (marked ★) — the argument needs them but does not state them. C1 is empirically predictive; C2 is normative and inherits all the contestability of its implicit premises.',
      groundedness: { kind: "interpretive" as const, band: "medium" as const }, _debugConfidence: 88,
    },
  },
};
