export type ValidityVerdict =
  | 'valid'                // conclusion follows necessarily from the premises as stated
  | 'invalid'              // conclusion does not follow; the premises could all be true and the conclusion false
  | 'inductively_strong'   // conclusion is probable given the premises, but not guaranteed
  | 'enthymematic'         // the argument is valid only if a specific suppressed premise is added
  | 'indeterminate';       // the argument's structure is too ambiguous to assess formally

export interface SuppressedPremise {
  text:       string;    // the premise that must be added for validity
  role:       string;    // what role the premise plays (major, bridging, scope-limiting, etc.)
  plausible:  boolean;   // whether the suppressed premise is prima facie plausible
}

export interface FormalPattern {
  name:        string;   // e.g. "modus ponens", "affirming the consequent", "undistributed middle"
  description: string;   // one-sentence explanation of the pattern
}

export interface StructuralValidityResult {
  verdict:              ValidityVerdict;
  formalPattern:        FormalPattern | null;
  schematicForm:        string;             // the argument rendered in symbolic form (P→Q, P ∴ Q)
  explanation:          string;             // why the argument is valid/invalid at the structural level
  suppressedPremises:   SuppressedPremise[];
  countermodel:         string | null;      // for invalid arguments: a scenario where premises are true but conclusion false
  confidence:           number;             // 0–100
  notes:                string | null;
}

export interface StructuralValidityDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
}
