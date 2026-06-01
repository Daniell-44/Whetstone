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

export interface ExtractionStatement {
  id:                        string;
  type:                      'premise' | 'conclusion';
  text:                      string;
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
