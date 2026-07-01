import type { ExtractionStatement, ArgumentExtractionResult } from '../argument-extraction/types';
import type { AuditResult } from './types';

// ---------------------------------------------------------------------------
// A4 — context-sensitive severity (phase 1: where a finding lands in the argument).
//
// A flat high/medium/low misses *where* a finding lands: the same fallacy on the
// conclusion or a load-bearing contested premise hurts the argument more than one
// on an incidental aside. We join a finding to its extracted statement, then shift
// its band by at most ONE level — additive and capped at ±1, which is predictable
// and conservative (a fragile multiplicative score overlapped the promote/demote
// cases). The shifts:
//
//   +1  on the conclusion, or on a load-bearing *contested-empirical* premise
//   -1  on a matched supporting aside
//    0  unmatched (rhetorical / can't place it) — NEVER penalised (the phase-1 bug)
//
// Design: `Research_Engine_Improvement_v1.md`. Phase 2 folds in stakes +
// recoverability as further ±1 nudges (total still capped at ±1). PURE + off by
// default: flag-gated (`?ctxsev=1`), A/B'd before it can change a shown severity.
// Surface as a band + a "because" line, never a number.
// ---------------------------------------------------------------------------

export type Severity = 'high' | 'medium' | 'low';

// Function words carry no topical signal — drop them so matching keys on content.
const STOPWORDS = new Set(
  'the and that this with for are was were will not but have has had from they them their there would could should shall might must any all can cannot our out who whom whose why how when what which then than into over under more most such been being does did done you your our its it is of to in on at as by or an be we us do so if no nor yet also just very about'.split(' '),
);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(norm(s).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w)));
}

// Inverse-document-frequency across the statements: a word in *every* premise
// (e.g. "helmet" when the whole argument is about helmets) carries little signal;
// distinctive words ("employment", "convenience") are what actually locate a
// finding. Smoothed so a single-statement word still scores usefully.
function buildIdf(statements: ExtractionStatement[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const st of statements) for (const t of tokenSet(st.text)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = statements.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log((N + 1) / (d + 0.5)));
  return idf;
}

// Minimum idf-weighted score (≈ one distinctive shared content word) for a
// finding to count as "about" a statement. Below this it stays UNMATCHED.
const MATCH_FLOOR = 1.0;

// The extracted statement a finding's quote is most about, or null when the join
// isn't confident. Findings quote raw/rhetorical draft text while statements are
// paraphrased premises, so we match on shared *distinctive* content words (idf-
// weighted), not raw overlap — rhetorical / loaded-language findings that share
// no propositional content simply stay unmatched.
export function matchStatement(quote: string, statements: ExtractionStatement[]): ExtractionStatement | null {
  if (statements.length === 0) return null;
  const idf = buildIdf(statements);
  const q = tokenSet(quote);
  let best: ExtractionStatement | null = null;
  let bestScore = MATCH_FLOOR;
  for (const st of statements) {
    const s = tokenSet(st.text);
    let score = 0;
    for (const t of q) if (s.has(t)) score += idf.get(t) ?? 0;
    if (score > bestScore) { bestScore = score; best = st; }
  }
  return best;
}

// How load-bearing the matched statement is. UNMATCHED IS NEUTRAL (1.0): we only
// move a finding's severity when we can confidently place it — never penalise a
// finding just because we couldn't map it. (That neutral default was the fix for
// the phase-1 "blanket downgrade" bug.)
export function loadFactor(stmt: ExtractionStatement | null, statements: ExtractionStatement[]): number {
  if (!stmt) return 1.0;
  if (stmt.type === 'conclusion') return 1.3;
  const loadBearing = statements.some(
    s => s.type === 'conclusion' && (s.derivedFrom ?? []).includes(stmt.id),
  );
  return loadBearing ? 1.15 : 0.95;
}

export interface ContextualSeverity {
  band:               Severity;      // context-adjusted band (what a flagged UI would show)
  baseBand:           Severity;      // the model's flat severity, unchanged
  delta:              number;        // band shift applied: -1, 0, or +1
  reason:             string;        // short "because" line for the UI
  matchedStatementId: string | null; // which extracted statement it was tied to
}

// Phase-2 inputs — optional, neutral by default. They need upstream signals that
// don't exist yet: `stakesFactor` from a topic-stakes classifier and `recoverable`
// from a per-finding recoverability tag. Each is a ±1 nudge; the total shift is
// still capped at ±1 so a finding never moves more than one band.
export interface Phase2Opts {
  stakesFactor?: number;   // >=1.2 raises the domain's stakes (+1); <=0.8 lowers (-1)
  recoverable?:  boolean;  // true = easily addressed (-1); false = decisive (+1)
}

const ORDER: Severity[] = ['low', 'medium', 'high'];
function shiftBand(base: Severity, delta: number): Severity {
  return ORDER[Math.max(0, Math.min(ORDER.length - 1, ORDER.indexOf(base) + delta))];
}

export function contextualSeverity(
  finding:    { quote: string; severity: Severity },
  extraction: ArgumentExtractionResult | null | undefined,
  opts:       Phase2Opts = {},
): ContextualSeverity {
  const statements = extraction?.statements ?? [];
  const stmt = statements.length ? matchStatement(finding.quote, statements) : null;
  const lf   = loadFactor(stmt, statements);   // 1.3 conclusion · 1.15 load-bearing · 0.95 aside · 1.0 unmatched

  let delta = 0;
  let reason: string;
  if (!stmt || lf === 1.0) {
    reason = 'not tied to a specific claim';
  } else if (lf >= 1.3) {
    delta += 1;
    reason = "on the argument's conclusion";
  } else if (lf >= 1.15) {
    reason = 'on a load-bearing premise';
    if (stmt.claimType === 'empirical_contested') { delta += 1; reason += ' (contested empirical)'; }
  } else {
    delta -= 1;
    reason = 'on a supporting aside';
  }

  // Phase-2 nudges (neutral unless a signal is supplied).
  if (opts.recoverable === false) delta += 1;
  else if (opts.recoverable === true) delta -= 1;
  if (opts.stakesFactor !== undefined) {
    if (opts.stakesFactor >= 1.2) delta += 1;
    else if (opts.stakesFactor <= 0.8) delta -= 1;
  }
  delta = Math.max(-1, Math.min(1, delta));    // one band at most

  return {
    band:               shiftBand(finding.severity, delta),
    baseBand:           finding.severity,
    delta,
    reason,
    matchedStatementId: stmt?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Whole-audit transform — returns a COPY of the audit with each span-anchored
// finding's severity replaced by its context-adjusted band. Flag-gated callers
// only: Reader/Studio pass the transformed audit to the display when the flag
// is on, so the display, sorting and score flow from the adjusted bands with
// zero display-code changes. Warrants keep their band (no reliable span quote).
// ---------------------------------------------------------------------------

function reband<T extends { severity: Severity }>(
  item: T, quote: string, extraction: ArgumentExtractionResult | null | undefined, opts: Phase2Opts,
): T {
  const band = contextualSeverity({ quote, severity: item.severity }, extraction, opts).band;
  return band === item.severity ? item : { ...item, severity: band };
}

export function applyContextualSeverity(
  audit:      AuditResult,
  extraction: ArgumentExtractionResult | null | undefined,
  opts:       Phase2Opts = {},
): AuditResult {
  return {
    ...audit,
    namedFallacies:       audit.namedFallacies.map(f => reband(f, f.quote, extraction, opts)),
    loadedLanguage:       audit.loadedLanguage.map(l => reband(l, l.phrase, extraction, opts)),
    keyTermScrutiny:      (audit.keyTermScrutiny      ?? []).map(f => reband(f, f.usage_a, extraction, opts)),
    referentChecks:       (audit.referentChecks       ?? []).map(f => reband(f, f.evidence, extraction, opts)),
    falsifiabilityChecks: (audit.falsifiabilityChecks ?? []).map(f => reband(f, f.evidence, extraction, opts)),
    modalScopeChecks:     (audit.modalScopeChecks     ?? []).map(f => reband(f, f.evidence, extraction, opts)),
  };
}
