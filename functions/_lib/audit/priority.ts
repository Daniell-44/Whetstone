// ---------------------------------------------------------------------------
// Priority scoring — replaces the legacy severity × confidence formula with
// severity × kindWeight. Honest ordering: structural and well-supported
// empirical findings outrank interpretive readings at the same severity.
// ---------------------------------------------------------------------------

import { kindWeight, type GroundednessSignal } from '../grounded/types';

type Scoreable = { severity: 'high' | 'medium' | 'low'; groundedness: GroundednessSignal };

export function priorityScore(finding: Scoreable): number {
  const severityWeight = { high: 3, medium: 2, low: 1 }[finding.severity];
  return severityWeight * kindWeight(finding.groundedness);
}

export function sortByPriority<T extends Scoreable>(findings: T[]): T[] {
  return [...findings].sort((a, b) => priorityScore(b) - priorityScore(a));
}
