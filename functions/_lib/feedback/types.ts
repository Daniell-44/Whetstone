export type FeedbackType = 'finding_thumbs_up' | 'finding_thumbs_down' | 'audit_rating' | 'bug_report';
export type TargetLens   = 'namedFallacies' | 'loadedLanguage' | 'unstatedWarrants' | 'counterarguments' | 'keyTermScrutiny' | 'referentChecks' | 'falsifiabilityChecks';

export interface FeedbackRow {
  id:               string;
  user_id:          string;
  document_id:      string | null;
  version_id:       string | null;
  feedback_type:    string;
  target_lens:      string | null;
  match_key:        string | null;
  finding_snapshot: string | null;  // JSON
  rating:           number | null;
  qualitative:      string | null;
  created_at:       number;
}

export interface FeedbackSubmission {
  feedbackType:    FeedbackType;
  documentId?:     string | null;
  versionId?:      string | null;
  targetLens?:     TargetLens | null;
  matchKey?:       string | null;
  findingSnapshot?: unknown | null;
  rating?:         number | null;
  qualitative?:    string | null;
}

export interface LensSummary {
  up:       number;
  down:     number;
  downRate: number;
}

export interface FeedbackSummary {
  ok:                 true;
  period:             { since: string; until: string };
  totals:             { thumbsUp: number; thumbsDown: number; auditRatings: number; bugReports: number };
  byLens:             Record<TargetLens, LensSummary>;
  qualitativeReasons: Array<{
    lens:            string | null;
    type:            string;
    text:            string;
    createdAt:       string;
    findingSnapshot: unknown;
  }>;
}
