import { structural } from '../../../functions/_lib/grounded/types';
import type { Sample } from './types';

const TEXT = `The legacy media's coverage of the economy is, frankly, a masterclass in distortion. Read any "respectable" newspaper and you'll be told that inflation is "moderating" — code for "we want you to stop noticing your weekly shop has doubled." Real people, real families, real businesses know what's happening. The experts who got us here are now telling us not to trust our own eyes.

When pressed, the response is always the same: "core" inflation, "structural" pressures, "transitory" effects. Whatever happened to plain English? The economy is collapsing and the official line is that the collapse is, technically, a recovery.

Of course the financial press won't say what's obvious. Their advertisers are the same corporations engineering the squeeze. Their readers are the small minority insulated from it. They don't have a stake in honesty — they have a stake in maintaining the illusion that the system is working.

The real question is not whether the economy is failing. It's why anyone still trusts the institutions that told us it wouldn't. We were lied to about wages, about debt, about asset bubbles, about housing, about "trickle-down". At what point do reasonable people simply stop listening?`;

export const POLEMIC_SAMPLE: Sample = {
  id:           'polemic',
  title:        'Distrust of the media',
  category:     'Polemic',
  shortLabel:   'Polemic',
  failureModes: ['gish gallop', 'motte-and-bailey', 'scare quotes', 'presupposition smuggling', 'ad hominem'],
  text:         TEXT,
  cached: {
    audit: {
      centralClaim: 'The mainstream financial press cannot be trusted because it serves corporate interests rather than readers.',
      toulmin: {
        claim:         'Mainstream financial media coverage of the economy is systematically dishonest.',
        grounds:       'Specific terms used by the press ("moderating", "core", "transitory") are misleading; financial press advertisers are the same entities benefiting from the economic conditions described; past institutional claims about wages, debt, housing, and trickle-down economics turned out to be wrong.',
        statedWarrant: null,
        unstatedWarrants: [
          {
            warrant:    'A history of being wrong about specific past claims entails systematic present dishonesty.',
            necessity:  'The final paragraph builds the case for distrust on past errors. But error and dishonesty are distinct — institutions can be sincerely wrong. The argument needs the bridging premise that wrongness implies dishonesty, which it never defends.',
            severity:   'high',
            groundedness: structural(), _debugConfidence: 88,
          },
          {
            warrant:    'Shared advertisers with industry constitutes evidence of editorial capture.',
            necessity:  'Paragraph 3 treats the financial-advertiser relationship as proof of bias. But for the inference to work, the argument needs the (contested) premise that advertising relationships override editorial independence in practice.',
            severity:   'medium',
            groundedness: structural(), _debugConfidence: 78,
          },
        ],
        weakestLink: 'The argument never distinguishes between technical economic language being unfamiliar to lay readers (which it is) and technical economic language being deceptive (which is a stronger claim requiring evidence the piece does not provide).',
      },
      namedFallacies: [
        {
          name:        'Ad Hominem',
          quote:       'Their advertisers are the same corporations engineering the squeeze. Their readers are the small minority insulated from it. They don\'t have a stake in honesty',
          explanation: 'Attacks the financial press\'s motives (advertisers, readership composition) rather than engaging with their economic claims. The structure of the argument is "the messenger is compromised, therefore the message is false" — which does not follow.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 90,
        },
        {
          name:        'Gish Gallop',
          quote:       'We were lied to about wages, about debt, about asset bubbles, about housing, about "trickle-down"',
          explanation: 'Strings together five separate contested claims as if each were established. Each would require its own examination — the rapid sequence prevents the reader from pausing on any one.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 85,
        },
        {
          name:        'Motte-and-Bailey',
          quote:       'At what point do reasonable people simply stop listening?',
          explanation: 'The Bailey throughout: "the press lies systematically and should be disregarded." The Motte (retreat position): "reasonable scepticism toward institutional claims is warranted." If pressed, the author can retreat to the Motte (which most would grant) while the Bailey carries the rhetorical weight.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 80,
        },
        {
          name:        'Genetic Fallacy',
          quote:       'The experts who got us here are now telling us not to trust our own eyes',
          explanation: 'Dismisses current expert claims based on association with past errors (the source\'s history) rather than evaluating the claims themselves. The pedigree of the claim is treated as deciding its truth.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 82,
        },
      ],
      loadedLanguage: [
        {
          phrase:      'a masterclass in distortion',
          technique:   'Emotionally charged terms',
          explanation: 'The phrase asserts intentional manipulation through sarcasm without arguing for it. The framing is the argument.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 92,
        },
        {
          phrase:      '"moderating"',
          technique:   'Scare quotes',
          explanation: 'Scare quotes around "moderating" implicitly contest the term\'s legitimacy without engaging with what it means in economic measurement. The contestation is performed, not argued.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 90,
        },
        {
          phrase:      '"respectable" newspaper',
          technique:   'Scare quotes',
          explanation: 'Same pattern — the scare quotes do the argumentative work that the prose would otherwise need to.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 85,
        },
        {
          phrase:      'engineering the squeeze',
          technique:   'Emotionally charged terms',
          explanation: 'The word "engineering" attributes deliberate intent to corporate actors — a substantial empirical claim — through diction rather than argument.',
          severity:    'high',
          groundedness: structural(), _debugConfidence: 88,
        },
        {
          phrase:      'Whatever happened to plain English?',
          technique:   'Presupposition smuggling',
          explanation: 'Presupposes that technical economic terminology is a departure from "plain English" with intent to obscure. The contested claim is embedded in the rhetorical question.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 82,
        },
      ],
      notes: null,
      keyTermScrutiny: [
        {
          term:        'lying',
          usage_a:     'We were lied to about wages',
          usage_b:     'They don\'t have a stake in honesty',
          issue:       'stipulative-smuggling',
          explanation: 'Across the piece, "lied" / "dishonest" is used to cover (a) the strong claim of deliberate falsehood and (b) the weaker claim of merely being wrong. The two usages let the argument retreat to the weaker meaning under pressure while carrying the rhetorical weight of the stronger one.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 78,
        },
      ],
      referentChecks: [
        {
          phrase:      'the experts',
          issue:       'vague-proper-name',
          explanation: 'Which experts? Federal Reserve economists? Academic economists? Newspaper columnists? The category is treated as a unified agent with shared culpability, when in fact "experts" hold widely divergent views on every claim discussed.',
          evidence:    'The experts who got us here are now telling us not to trust our own eyes.',
          severity:    'medium',
          groundedness: structural(), _debugConfidence: 85,
        },
      ],
      falsifiabilityChecks: [],
      modalScopeChecks: [],
    },
    extraction: {
      centralClaim: 'The mainstream financial press cannot be trusted on economic coverage.',
      statements: [
        { id: 'P1', type: 'premise', text: 'Mainstream financial press uses technical terminology that ordinary readers find opaque.', claimType: 'empirical_uncontested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P2', type: 'premise', text: 'The same corporations that benefit from current economic conditions advertise in the financial press.', claimType: 'empirical_uncontested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P3', type: 'premise', text: 'Past institutional claims about wages, debt, asset bubbles, housing, and trickle-down economics were wrong.', claimType: 'empirical_contested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P4', type: 'premise', text: '★ Advertiser relationships override editorial independence.', claimType: 'empirical_contested', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'P5', type: 'premise', text: '★ Being wrong about past claims implies present dishonesty.', claimType: 'normative', derivedFrom: [], inferenceRule: null, inferenceRuleExplanation: null },
        { id: 'C1', type: 'conclusion', text: 'The financial press has structural incentives that compromise editorial honesty.', claimType: 'empirical_contested', derivedFrom: ['P2', 'P4'], inferenceRule: 'modus_ponens', inferenceRuleExplanation: 'The advertiser relationship (P2) combined with the assumption that advertising overrides editorship (P4) yields the structural-incentive claim.' },
        { id: 'C2', type: 'conclusion', text: 'The financial press cannot be trusted on economic coverage.', claimType: 'normative', derivedFrom: ['C1', 'P3', 'P5'], inferenceRule: 'inductive_generalisation', inferenceRuleExplanation: 'Structural incentives (C1), past wrongness (P3), and the wrongness-implies-dishonesty principle (P5) jointly support the general distrust conclusion.' },
      ],
      notes:      'P4 and P5 are implicit (★) and do the heavy lifting. Neither is defended in the text. The argument also presents P3 as established when it is itself contested.',
      groundedness: { kind: "interpretive" as const, band: "medium" as const }, _debugConfidence: 81,
    },
  },
};
