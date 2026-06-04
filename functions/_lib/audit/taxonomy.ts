export const FALLACY_NAMES = [
  // Original twelve
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
  // Peirce-derived inferential patterns
  'Abductive Closure',
  'Selection Bias',
  'Base-Rate Neglect',
  // Classical and modern additions
  'No True Scotsman',
  'Cherry-Picking',
  'Texas Sharpshooter',
  'Composition',
  'Division',
  'Argument from Ignorance',
  'Gish Gallop',
  'Moving the Goalposts',
  // Strategic and structural fallacies
  'Motte-and-Bailey',
  'Special Pleading',
  'Genetic Fallacy',
] as const;

export type FallacyName = (typeof FALLACY_NAMES)[number];

export const FALLACY_DESCRIPTIONS: Record<FallacyName, string> = {
  'Ad Hominem':              'Attacking the person making the argument rather than the argument itself.',
  'Straw Man':               'Misrepresenting an opponent\'s position to make it easier to attack.',
  'False Dichotomy':         'Presenting only two options when more exist.',
  'Slippery Slope':          'Claiming one event will lead to extreme consequences without sufficient justification.',
  'Appeal to Authority':     'Using an authority figure\'s opinion as evidence without supporting argument.',
  'Appeal to Emotion':       'Manipulating emotions rather than using logical reasoning.',
  'Circular Reasoning':      'Using the conclusion as a premise in the argument.',
  'Hasty Generalisation':    'Drawing broad conclusions from a small or unrepresentative sample.',
  'Red Herring':             'Introducing irrelevant information to distract from the main issue.',
  'Tu Quoque':               'Deflecting criticism by pointing out the critic\'s own similar behaviour.',
  'Post Hoc':                'Assuming causation from mere temporal sequence.',
  'Equivocation':            'Using a word with multiple meanings in different senses within the same argument.',
  'Abductive Closure':       'Treating one explanation as final without ruling out alternative explanations the evidence equally supports.',
  'Selection Bias':          'Drawing a general conclusion from a non-representative sample due to flawed sample composition, not merely sample size.',
  'Base-Rate Neglect':       'Probabilistic reasoning that ignores how rare or common the underlying phenomenon is.',
  'No True Scotsman':        'Refusing counter-examples by progressively redefining the term to exclude disconfirming cases.',
  'Cherry-Picking':          'Selecting only favourable evidence while ignoring contrary evidence that also exists.',
  'Texas Sharpshooter':      'Drawing a conclusion from a non-representative data cluster found after the fact rather than predicted in advance.',
  'Composition':             'Assuming what is true of the parts is true of the whole.',
  'Division':                'Assuming what is true of the whole is true of the parts.',
  'Argument from Ignorance': 'Treating absence of evidence as evidence of absence (or vice versa).',
  'Gish Gallop':             'Overwhelming with many weak arguments rather than offering a few strong ones.',
  'Moving the Goalposts':    'Raising the bar for what counts as sufficient evidence when challenged.',
  'Motte-and-Bailey':        'Defending a controversial claim (the Bailey) under pressure by retreating to an uncontroversial one (the Motte), then re-advancing the controversial claim as if the Motte had established it.',
  'Special Pleading':        'Applying a principle to all cases except one\'s own or a favoured case, without principled justification for the exemption.',
  'Genetic Fallacy':         'Dismissing or accepting a claim solely on the basis of its source or origin rather than its merits.',
};

export const LOADED_LANGUAGE_TECHNIQUES = [
  'Emotionally charged terms',
  'Weasel words',
  'Name-calling / dysphemism',
  'Glittering generalities',
  'False-precision numbers',
  'Euphemism',
  'Scare quotes',
  'Presupposition smuggling',
] as const;

export type LoadedLanguageTechnique = (typeof LOADED_LANGUAGE_TECHNIQUES)[number];

export const LOADED_LANGUAGE_DESCRIPTIONS: Record<LoadedLanguageTechnique, string> = {
  'Emotionally charged terms':  'Words chosen to trigger strong emotional responses rather than convey neutral information.',
  'Weasel words':               'Vague qualifiers that create an impression of credibility without a real commitment.',
  'Name-calling / dysphemism':  'Labelling people or ideas with pejorative terms to trigger negative associations.',
  'Glittering generalities':    'Vague virtuous words (freedom, family, justice) with no concrete meaning.',
  'False-precision numbers':    'Specific-sounding statistics presented without source or context to imply authority.',
  'Euphemism':                  'Substituting a palatable term for an accurate but uncomfortable one, obscuring the nature of what is being described.',
  'Scare quotes':               'Using quotation marks around a term to implicitly question its legitimacy without argument.',
  'Presupposition smuggling':   'Framing a question or statement so that accepting its terms already commits the reader to a contested assumption.',
};
