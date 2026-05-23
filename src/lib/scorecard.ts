// Re-exports the canonical Scorecard types from their authoritative location.
// The engine (functions/) and the Astro site (src/) both use these types;
// they live in functions/ so the engine can import them without crossing
// the src/ boundary. Site components import from here as before.
export type {
  ToulminChain,
  ScorecardSource,
  ScorecardPosition,
  Scorecard,
} from '../../functions/_lib/scorecard/types';
