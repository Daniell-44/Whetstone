import type { AuditResult } from './types';
import { kindWeight } from '../grounded/types';

// ---------------------------------------------------------------------------
// Text statistics — pure functions, no side effects
// ---------------------------------------------------------------------------

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

export function sentenceCount(text: string): number {
  const matches = text.match(/[.!?]+(?=\s|$)/g);
  return Math.max(1, matches ? matches.length : 0);
}

export function avgSentenceLength(text: string): number {
  const words     = wordCount(text);
  const sentences = sentenceCount(text);
  return Math.round(words / sentences);
}

function syllableCount(word: string): number {
  const lower   = word.toLowerCase().replace(/[^a-z]/g, '');
  const matches = lower.match(/[aeiou]+/g);
  return Math.max(1, matches ? matches.length : 0);
}

export function fleschKincaidGradeLevel(text: string): number {
  const words     = wordCount(text);
  const sentences = sentenceCount(text);
  if (words === 0) return 0;

  const allWords  = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = allWords.reduce((sum, w) => sum + syllableCount(w), 0);

  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

// ---------------------------------------------------------------------------
// Audit result statistics
// ---------------------------------------------------------------------------

export function severityBreakdown(audit: AuditResult): { high: number; medium: number; low: number } {
  const findings = [
    ...audit.namedFallacies,
    ...audit.loadedLanguage,
    ...audit.toulmin.unstatedWarrants,
    ...(audit.keyTermScrutiny      ?? []),
    ...(audit.referentChecks       ?? []),
    ...(audit.falsifiabilityChecks ?? []),
    ...(audit.modalScopeChecks     ?? []),
  ];
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );
}

export function totalFindingCount(audit: AuditResult): number {
  return (
    audit.namedFallacies.length +
    audit.loadedLanguage.length +
    audit.toulmin.unstatedWarrants.length +
    (audit.keyTermScrutiny      ?? []).length +
    (audit.referentChecks       ?? []).length +
    (audit.falsifiabilityChecks ?? []).length +
    (audit.modalScopeChecks     ?? []).length
  );
}

// ---------------------------------------------------------------------------
// Argument quality score (0–100)
//
// Starts at 100 and deducts per finding, weighted by:
//   - severity   (high/medium/low)
//   - kindWeight (structural > empirical w/ consensus > interpretive)
//
// The kind weighting means a structural fallacy (verifiable in the quoted
// text) drags the score more than an interpretive reading. This is honest:
// findings the reader can verify deserve more weight than findings that
// depend on a debatable reading.
//
// Logarithmic-ish cap so a heavily-flagged piece can't score 0.
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<string, number> = { high: 8, medium: 4, low: 1.5 };

export function argumentScore(audit: AuditResult): number {
  const findings = [
    ...audit.namedFallacies,
    ...audit.loadedLanguage,
    ...audit.toulmin.unstatedWarrants,
    ...(audit.keyTermScrutiny      ?? []),
    ...(audit.referentChecks       ?? []),
    ...(audit.falsifiabilityChecks ?? []),
    ...(audit.modalScopeChecks     ?? []),
  ];

  if (findings.length === 0) return 100;

  let totalDeduction = 0;
  for (const f of findings) {
    const sevWeight  = SEVERITY_WEIGHT[f.severity] ?? 2;
    const kindFactor = kindWeight(f.groundedness);
    totalDeduction  += sevWeight * kindFactor;
  }

  const scaled = Math.min(80, totalDeduction * 2.5);
  return Math.max(10, Math.round(100 - scaled));
}

// ---------------------------------------------------------------------------
// Groundedness mix — how many findings are each KIND. Powers the one-line
// verdict below; the categorical honesty label (Logic / Judgment call /
// Factual) is the product's differentiator, so surfacing its distribution in
// plain language is worth a derived helper.
// ---------------------------------------------------------------------------

export function groundednessBreakdown(audit: AuditResult): { structural: number; interpretive: number; empirical: number } {
  const findings = [
    ...audit.namedFallacies,
    ...audit.loadedLanguage,
    ...audit.toulmin.unstatedWarrants,
    ...(audit.keyTermScrutiny      ?? []),
    ...(audit.referentChecks       ?? []),
    ...(audit.falsifiabilityChecks ?? []),
    ...(audit.modalScopeChecks     ?? []),
  ];
  const acc = { structural: 0, interpretive: 0, empirical: 0 };
  for (const f of findings) {
    const k = f.groundedness?.kind;
    if (k === 'structural' || k === 'interpretive' || k === 'empirical') acc[k] += 1;
  }
  return acc;
}

// One-line structural verdict — a plain-language read of the finding shape for
// a reader who won't open every card. When findings exist the count is shown
// elsewhere, so this sentence carries the NEW information: which *kind* of
// finding dominates (logic vs judgment call), which tells the reader how
// settled the audit's objections are. Derived, not model-emitted.
export function auditVerdict(audit: AuditResult): string {
  const total = totalFindingCount(audit);
  if (total === 0) {
    return 'Clean bill — no reasoning fallacies or loaded language surfaced. The argument stands on its structure.';
  }
  const g      = groundednessBreakdown(audit);
  const gTotal = g.structural + g.interpretive + g.empirical;
  let clause   = 'A mix of logic and judgment calls.';
  if (gTotal > 0) {
    if (g.structural / gTotal >= 0.6)        clause = 'Mostly matters of logic you can check against the quoted text.';
    else if (g.interpretive / gTotal >= 0.6) clause = 'Mostly judgment calls that turn on how you read the piece.';
  }
  if (g.empirical > 0) clause += ' Some hinge on facts outside the text.';
  return clause;
}

// Which lenses the audit checked — the anonymous-transparency "scope" strip.
// The three base lenses ALWAYS run (shown with their count, including 0 — that
// is the point: a clean result reads as "checked, nothing found", not "did it
// run?"). Phase-2 lenses are only listed when they produced a finding, since an
// empty phase-2 array can't distinguish "ran, found nothing" from "not run"
// (base-only audits still carry them as `[]` via the schema default) — so we
// never claim a phase-2 lens ran unless it demonstrably did.
export interface LensChecked { key: string; label: string; count: number; base: boolean }

export function lensesChecked(audit: AuditResult): LensChecked[] {
  const out: LensChecked[] = [
    { key: 'namedFallacies',   label: 'Reasoning fallacies', count: audit.namedFallacies.length,               base: true },
    { key: 'loadedLanguage',   label: 'Loaded language',     count: audit.loadedLanguage.length,               base: true },
    { key: 'unstatedWarrants', label: 'Unstated assumptions', count: audit.toulmin.unstatedWarrants.length,    base: true },
  ];
  const phase2: Array<[string, string, unknown[] | undefined]> = [
    ['keyTermScrutiny',      'Key-term consistency',  audit.keyTermScrutiny],
    ['referentChecks',       'Referential clarity',   audit.referentChecks],
    ['falsifiabilityChecks', 'Falsifiability',        audit.falsifiabilityChecks],
    ['modalScopeChecks',     'Modal scope',           audit.modalScopeChecks],
  ];
  for (const [key, label, arr] of phase2) {
    const a = (arr ?? []) as unknown[];
    if (a.length > 0) out.push({ key, label, count: a.length, base: false });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Priority score for individual findings — used to sort the findings list.
// ---------------------------------------------------------------------------

export function findingPriorityScore<T extends { severity: 'high' | 'medium' | 'low'; groundedness: import('../grounded/types').GroundednessSignal }>(
  f: T,
): number {
  return (SEVERITY_WEIGHT[f.severity] ?? 2) * kindWeight(f.groundedness);
}
