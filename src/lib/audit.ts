export type {
  AuditResult,
  ToulminAnalysis,
  NamedFallacy,
  LoadedLanguage,
  UnstatedWarrant,
  KeyTermScrutinyFinding,
  ReferentCheckFinding,
  FalsifiabilityFinding,
  ModalScopeCheckFinding,
  KeyTermIssue,
  ReferentIssue,
  FalsifiabilityIssue,
  ModalScopeIssue,
} from '../../functions/_lib/audit/types';

export { priorityScore, sortByPriority } from '../../functions/_lib/audit/priority';
export { wordCount, avgSentenceLength, fleschKincaidGradeLevel, severityBreakdown, totalFindingCount, argumentScore } from '../../functions/_lib/audit/stats';
export {
  fallacyMatchKey,
  loadedLanguageMatchKey,
  unstatedWarrantMatchKey,
  keyTermMatchKey,
  referentMatchKey,
  falsifiabilityMatchKey,
  modalScopeMatchKey,
} from '../../functions/_lib/audit/match-keys';
