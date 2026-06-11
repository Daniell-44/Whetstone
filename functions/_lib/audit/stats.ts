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
// Priority score for individual findings — used to sort the findings list.
// ---------------------------------------------------------------------------

export function findingPriorityScore<T extends { severity: 'high' | 'medium' | 'low'; groundedness: import('../grounded/types').GroundednessSignal }>(
  f: T,
): number {
  return (SEVERITY_WEIGHT[f.severity] ?? 2) * kindWeight(f.groundedness);
}
