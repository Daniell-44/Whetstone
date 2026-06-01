export type {
  AuditResult,
  ToulminAnalysis,
  NamedFallacy,
  LoadedLanguage,
  UnstatedWarrant,
  KeyTermScrutinyFinding,
  ReferentCheckFinding,
  FalsifiabilityFinding,
  KeyTermIssue,
  ReferentIssue,
  FalsifiabilityIssue,
} from '../../functions/_lib/audit/types';

export { priorityScore, sortByPriority } from '../../functions/_lib/audit/priority';
export { wordCount, avgSentenceLength, fleschKincaidGradeLevel, severityBreakdown, totalFindingCount } from '../../functions/_lib/audit/stats';
export {
  fallacyMatchKey,
  loadedLanguageMatchKey,
  unstatedWarrantMatchKey,
  keyTermMatchKey,
  referentMatchKey,
  falsifiabilityMatchKey,
} from '../../functions/_lib/audit/match-keys';
