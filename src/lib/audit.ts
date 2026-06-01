export type {
  AuditResult,
  ToulminAnalysis,
  NamedFallacy,
  LoadedLanguage,
  UnstatedWarrant,
} from '../../functions/_lib/audit/types';

export { priorityScore, sortByPriority } from '../../functions/_lib/audit/priority';
export { wordCount, avgSentenceLength, fleschKincaidGradeLevel, severityBreakdown, totalFindingCount } from '../../functions/_lib/audit/stats';
export { fallacyMatchKey, loadedLanguageMatchKey, unstatedWarrantMatchKey } from '../../functions/_lib/audit/match-keys';
