export interface StrongestCase {
  claim:   string;
  grounds: string;
  warrant: string;
}

export interface Counterargument {
  position:      string;
  strongestCase: StrongestCase;
  missedByDraft: string;
  why:           string;
}

export interface CounterargumentResult {
  centralClaim:     string;
  counterarguments: Counterargument[];
  notes:            string | null;
}

export interface CounterargDeps {
  provider:        import('../providers/types').LlmProvider;
  apiKey:          string;
  model?:          string;
  backoffDelaysMs?: readonly number[];
}
