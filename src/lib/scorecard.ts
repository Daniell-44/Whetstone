export interface ToulminChain {
  claim:   string;
  grounds: string;
  warrant: string;
}

export interface ScorecardSource {
  title:       string;
  publication: string;
  url:         string;
}

export interface ScorecardPosition {
  label:     string;
  bestCase:  ToulminChain;
  fatalFlaw: { name: string; explanation: string };
  sources:   ScorecardSource[];
}

export interface Scorecard {
  slug:          string;
  question:      string;
  dek:           string;
  positions:     ScorecardPosition[];
  metaAnalysis:  { bridgingWarrant: string; explanation: string };
  publishedDate: string;
}
