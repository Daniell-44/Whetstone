export type InferenceRule =
  | 'modus_ponens'
  | 'modus_tollens'
  | 'hypothetical_syllogism'
  | 'disjunctive_syllogism'
  | 'categorical_syllogism'
  | 'inductive_generalisation'
  | 'abduction'
  | 'analogy'
  | 'other';

// How the claim is grounded — critical for evidence-weighted likelihood feature:
// only empirical_contested claims should ever receive confidence percentages.
export type ClaimType =
  | 'empirical_contested'    // factual claim where evidence is genuinely uncertain or debated
  | 'empirical_uncontested'  // factual claim that is well-established
  | 'normative'              // value or ought claim; not empirically testable
  | 'definitional'           // true by definition or stipulation
  | 'modal_predictive';      // claim about what will / might / must happen

export interface ExtractionStatement {
  id:                        string;
  type:                      'premise' | 'conclusion';
  text:                      string;
  claimType:                 ClaimType;
  derivedFrom?:              string[] | null;
  inferenceRule?:            InferenceRule | null;
  inferenceRuleExplanation?: string | null;
}

export interface ArgumentExtractionResult {
  centralClaim: string;
  statements:   ExtractionStatement[];
  notes:        string | null;
  confidence:   number;
}

export interface ExtractionDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
