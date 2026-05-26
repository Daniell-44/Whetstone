export const FALLACY_NAMES = [
  'Ad Hominem',
  'Straw Man',
  'False Dichotomy',
  'Slippery Slope',
  'Appeal to Authority',
  'Appeal to Emotion',
  'Circular Reasoning',
  'Hasty Generalisation',
  'Red Herring',
  'Tu Quoque',
  'Post Hoc',
  'Equivocation',
] as const;

export type FallacyName = (typeof FALLACY_NAMES)[number];

export const FALLACY_DESCRIPTIONS: Record<FallacyName, string> = {
  'Ad Hominem':            'Attacking the person making the argument rather than the argument itself.',
  'Straw Man':             'Misrepresenting an opponent\'s position to make it easier to attack.',
  'False Dichotomy':       'Presenting only two options when more exist.',
  'Slippery Slope':        'Claiming one event will lead to extreme consequences without sufficient justification.',
  'Appeal to Authority':   'Using an authority figure\'s opinion as evidence without supporting argument.',
  'Appeal to Emotion':     'Manipulating emotions rather than using logical reasoning.',
  'Circular Reasoning':    'Using the conclusion as a premise in the argument.',
  'Hasty Generalisation':  'Drawing broad conclusions from a small or unrepresentative sample.',
  'Red Herring':           'Introducing irrelevant information to distract from the main issue.',
  'Tu Quoque':             'Deflecting criticism by pointing out the critic\'s own similar behaviour.',
  'Post Hoc':              'Assuming causation from mere temporal sequence.',
  'Equivocation':          'Using a word with multiple meanings in different senses within the same argument.',
};

export const LOADED_LANGUAGE_TECHNIQUES = [
  'Emotionally charged terms',
  'Weasel words',
  'Name-calling / dysphemism',
  'Glittering generalities',
  'False-precision numbers',
] as const;

export type LoadedLanguageTechnique = (typeof LOADED_LANGUAGE_TECHNIQUES)[number];

export const LOADED_LANGUAGE_DESCRIPTIONS: Record<LoadedLanguageTechnique, string> = {
  'Emotionally charged terms':  'Words chosen to trigger strong emotional responses rather than convey neutral information.',
  'Weasel words':               'Vague qualifiers that create an impression of credibility without a real commitment.',
  'Name-calling / dysphemism':  'Labelling people or ideas with pejorative terms to trigger negative associations.',
  'Glittering generalities':    'Vague virtuous words (freedom, family, justice) with no concrete meaning.',
  'False-precision numbers':    'Specific-sounding statistics presented without source or context to imply authority.',
};
