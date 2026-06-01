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
  return audit.namedFallacies.length + audit.loadedLanguage.length + audit.toulmin.unstatedWarrants.length;
}
