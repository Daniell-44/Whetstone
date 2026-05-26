export interface UnstatedWarrant {
  warrant:   string;
  necessity: string;
}

export interface ToulminAnalysis {
  claim:            string;
  grounds:          string;
  statedWarrant:    string | null;
  unstatedWarrants: UnstatedWarrant[];
  weakestLink:      string;
}

export interface NamedFallacy {
  name:        string;
  quote:       string;
  explanation: string;
  severity:    'high' | 'medium' | 'low';
}

export interface LoadedLanguage {
  phrase:      string;
  technique:   string;
  explanation: string;
}

export interface AuditResult {
  centralClaim:  string;
  toulmin:       ToulminAnalysis;
  namedFallacies: NamedFallacy[];
  loadedLanguage: LoadedLanguage[];
  notes:         string | null;
}

export interface AuditInput {
  text: string;
}

export interface AuditDeps {
  provider:        import('../providers/types').LlmProvider;
  apiKey:          string;
  model?:          string;
  backoffDelaysMs?: readonly number[];
}
