export interface UnstatedWarrant {
  warrant:    string;
  necessity:  string;
  severity:   'high' | 'medium' | 'low';
  confidence: number;
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
  confidence:  number;
}

export interface LoadedLanguage {
  phrase:      string;
  technique:   string;
  explanation: string;
  severity:    'high' | 'medium' | 'low';
  confidence:  number;
}

// ---------------------------------------------------------------------------
// Phase-2 issue types
// ---------------------------------------------------------------------------

export type KeyTermIssue =
  | 'stipulative-smuggling'
  | 'cross-language-game-equivocation'
  | 'family-resemblance-overreach';

export type ReferentIssue =
  | 'empty-referent'
  | 'vague-proper-name'
  | 'failed-presupposition';

export type FalsifiabilityIssue =
  | 'no-truth-conditions'
  | 'circular-truth-conditions'
  | 'unfalsifiable-dressed-as-substantive';

// ---------------------------------------------------------------------------
// Phase-2 finding interfaces
// ---------------------------------------------------------------------------

export interface KeyTermScrutinyFinding {
  term:        string;
  usage_a:     string;    // verbatim first use from input
  usage_b:     string;    // verbatim second use showing the shift
  issue:       KeyTermIssue;
  explanation: string;
  severity:    'high' | 'medium' | 'low';
  confidence:  number;
}

export interface ReferentCheckFinding {
  phrase:      string;    // verbatim phrase with the problematic referent
  issue:       ReferentIssue;
  explanation: string;
  evidence:    string;    // verbatim substring from input
  severity:    'high' | 'medium' | 'low';
  confidence:  number;
}

export interface FalsifiabilityFinding {
  claim:       string;    // brief paraphrase of the claim
  issue:       FalsifiabilityIssue;
  explanation: string;
  evidence:    string;    // verbatim substring from input
  severity:    'high' | 'medium' | 'low';
  confidence:  number;
}

// ---------------------------------------------------------------------------
// Core result
// ---------------------------------------------------------------------------

export interface AuditResult {
  centralClaim:         string;
  toulmin:              ToulminAnalysis;
  namedFallacies:       NamedFallacy[];
  loadedLanguage:       LoadedLanguage[];
  notes:                string | null;
  keyTermScrutiny:      KeyTermScrutinyFinding[];
  referentChecks:       ReferentCheckFinding[];
  falsifiabilityChecks: FalsifiabilityFinding[];
}

export interface AuditInput {
  text: string;
}

export interface AuditDeps {
  provider:         import('../providers/types').LlmProvider;
  apiKey:           string;
  model?:           string;
  backoffDelaysMs?: readonly number[];
  includePhase2?:   boolean;
}
