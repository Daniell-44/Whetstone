import type { ClaimType, ExtractionStatement, ArgumentExtractionResult } from '../argument-extraction/types';

// ---------------------------------------------------------------------------
// A4 — context-sensitive severity (phase 1: loadFactor + claimTypeFactor).
//
// A flat high/medium/low misses *where* a finding lands: the same fallacy on a
// load-bearing, contested premise hurts the argument more than one on an
// incidental aside. We nudge the model's base band by two context factors read
// from the argument extraction, joining a finding to its statement by quote
// overlap:
//
//   adjusted = baseSeverity × claimTypeFactor × loadFactor
//
// Design: `Research_Engine_Improvement_v1.md` (CVSS-style). Phase 2 adds stakes
// + a recoverability tag. This is a PURE function, off by default — it is not
// wired into production display/sorting yet; it must be A/B'd (like the
// precision preset) before it can change a shown severity. Surface as a band +
// a "because" line, never a number.
// ---------------------------------------------------------------------------

export type Severity = 'high' | 'medium' | 'low';

const BASE: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

// A checkable, genuinely-contested empirical premise carries more weight than a
// well-established fact or a bare definition.
const CLAIM_TYPE_FACTOR: Record<ClaimType, number> = {
  empirical_contested:   1.2,
  modal_predictive:      1.1,
  normative:             1.0,
  definitional:          1.0,
  empirical_uncontested: 0.9,
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(norm(s).split(' ').filter(w => w.length > 2));
}

// Fraction of the finding's quote tokens that appear in the statement text.
function overlap(quote: string, statement: string): number {
  const q = tokenSet(quote);
  if (q.size === 0) return 0;
  const s = tokenSet(statement);
  let hit = 0;
  for (const t of q) if (s.has(t)) hit++;
  return hit / q.size;
}

const MATCH_THRESHOLD = 0.5;

// The extracted statement a finding's quote is most about, or null if none
// clears the overlap threshold (findings often quote incidental phrasing).
export function matchStatement(quote: string, statements: ExtractionStatement[]): ExtractionStatement | null {
  let best: ExtractionStatement | null = null;
  let bestScore = MATCH_THRESHOLD;
  for (const st of statements) {
    const sc = overlap(quote, st.text);
    if (sc > bestScore) { bestScore = sc; best = st; }
  }
  return best;
}

// How load-bearing the matched statement is: the conclusion is the argument's
// payload; a premise the conclusion rests on matters more than an aside.
export function loadFactor(stmt: ExtractionStatement | null, statements: ExtractionStatement[]): number {
  if (!stmt) return 0.85;
  if (stmt.type === 'conclusion') return 1.3;
  const loadBearing = statements.some(
    s => s.type === 'conclusion' && (s.derivedFrom ?? []).includes(stmt.id),
  );
  return loadBearing ? 1.15 : 0.95;
}

function bandFor(score: number): Severity {
  if (score >= 3.0) return 'high';
  if (score >= 1.7) return 'medium';
  return 'low';
}

export interface ContextualSeverity {
  band:               Severity;      // context-adjusted band (what a flagged UI would show)
  baseBand:           Severity;      // the model's flat severity, unchanged
  factor:             number;        // combined multiplier, rounded to 2dp
  reason:             string;        // short "because" line for the UI
  matchedStatementId: string | null; // which extracted statement it was tied to
}

export function contextualSeverity(
  finding:    { quote: string; severity: Severity },
  extraction: ArgumentExtractionResult | null | undefined,
): ContextualSeverity {
  const statements = extraction?.statements ?? [];
  const stmt   = statements.length ? matchStatement(finding.quote, statements) : null;
  const ctf    = stmt ? (CLAIM_TYPE_FACTOR[stmt.claimType] ?? 1) : 1;
  const lf     = loadFactor(stmt, statements);
  const factor = ctf * lf;
  const band   = bandFor(BASE[finding.severity] * factor);

  let reason: string;
  if (!stmt) {
    reason = 'on a point not tied to the core argument';
  } else {
    const place = stmt.type === 'conclusion' ? "the argument's conclusion"
      : lf > 1 ? 'a load-bearing premise'
      : 'a supporting point';
    const kind = stmt.claimType === 'empirical_contested' ? ' (contested empirical)'
      : stmt.claimType === 'modal_predictive'             ? ' (predictive)'
      : stmt.claimType === 'normative'                    ? ' (normative)'
      : '';
    reason = `on ${place}${kind}`;
  }

  return {
    band,
    baseBand:           finding.severity,
    factor:             Math.round(factor * 100) / 100,
    reason,
    matchedStatementId: stmt?.id ?? null,
  };
}
