export function priorityScore(finding: { severity: 'high' | 'medium' | 'low'; confidence: number }): number {
  const severityWeight = { high: 3, medium: 2, low: 1 }[finding.severity];
  return severityWeight * (finding.confidence / 100);
}

export function sortByPriority<T extends { severity: 'high' | 'medium' | 'low'; confidence: number }>(findings: T[]): T[] {
  return [...findings].sort((a, b) => priorityScore(b) - priorityScore(a));
}
