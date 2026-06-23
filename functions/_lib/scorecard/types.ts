// Canonical scorecard types — shared between the synthesis engine (functions/) and
// the Astro site (src/). src/lib/scorecard.ts re-exports from here.

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
  /** Optional left-right placement (-100..+100). Drives the Briefing spectrum.
   *  Absent on legacy scorecards, which simply render without a spectrum. */
  leaning?:  number;
}

export type ScorecardCategory =
  | 'politics'
  | 'economics'
  | 'science'
  | 'technology'
  | 'health'
  | 'culture'
  | 'philosophy'
  | 'law'
  | 'environment'
  | 'education';

export interface Scorecard {
  slug:          string;
  question:      string;
  dek:           string;
  category?:     ScorecardCategory;
  positions:     ScorecardPosition[];
  metaAnalysis:  { bridgingWarrant: string; explanation: string };
  /** The two poles of the debate's primary axis, e.g. { left: 'displacement',
   *  right: 'augmentation' }. Drives the position spectrum. Optional — legacy
   *  scorecards without it (or without per-position `leaning`) render flat. */
  spectrumAxis?: { left: string; right: string };
  publishedDate: string;
}
