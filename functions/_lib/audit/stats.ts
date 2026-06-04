import type { AuditResult } from './types';

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
// Starts at 100 and deducts based on findings weighted by severity and
// confidence. The formula intentionally caps deductions so that even a
// heavily-flagged piece doesn't score 0 (some arguments are intentionally
// provocative and still structurally valid).
//
// The score answers: "how structurally clean is this argument?"
// High = few issues. Low = many high-severity issues. Not a verdict on
// whether the argument is *right* — only whether it's well-constructed.
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
    const weight     = SEVERITY_WEIGHT[f.severity] ?? 2;
    const confidence = f.confidence / 100;
    totalDeduction  += weight * confidence;
  }

  // Logarithmic scaling so many small issues don't crater the score
  // but a few high-severity issues cause meaningful drops
  const scaled = Math.min(80, totalDeduction * 2.5);
  return Math.max(10, Math.round(100 - scaled));
}
