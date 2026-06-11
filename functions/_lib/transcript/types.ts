import type { AuditResult } from '../audit/types';
import type { ArgumentExtractionResult } from '../argument-extraction/types';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface TranscriptCue {
  startSec: number;
  endSec:   number;
  text:     string;
}

// Source of a transcript — either pasted text (with optional cues) or fetched from a URL.
export interface TranscriptInput {
  sourceType: 'paste' | 'youtube';
  sourceUrl:  string | null;       // YouTube URL if applicable
  title:      string | null;       // video title if known
  cues:       TranscriptCue[];     // if pasted as plain text, one cue covering everything
}

// ---------------------------------------------------------------------------
// Segmentation (Stage A)
// ---------------------------------------------------------------------------

export type SegmentKind =
  | 'argument'         // the speaker is advancing a claim with reasoning
  | 'narrative'        // story or anecdote (excluded from audit)
  | 'sponsor_read'     // ad break
  | 'introduction'     // intro / outro
  | 'tangent'          // off-topic banter
  | 'listener_mail'    // Q&A or fan letters
  | 'other';

export interface ArgumentSegment {
  id:           string;
  kind:         SegmentKind;
  startSec:     number;
  endSec:       number;
  claimSummary: string;          // 1-sentence summary of the argument advanced
  text:         string;          // verbatim transcript text for this segment
  confidence:   number;          // 0–100, confidence this is an argumentative segment
}

export interface SegmentationResult {
  segments:        ArgumentSegment[];
  totalSegments:   number;
  argumentCount:   number;
  excludedCount:   number;
  notes:           string | null;
}

// ---------------------------------------------------------------------------
// Per-segment audit results (Stage B)
// ---------------------------------------------------------------------------

export interface SegmentAudit {
  segmentId:  string;
  audit:      AuditResult;
  extraction: ArgumentExtractionResult;
}

// ---------------------------------------------------------------------------
// Cross-segment synthesis (Stage C)
// ---------------------------------------------------------------------------

export type CrossSegmentFindingKind =
  | 'walked_back_claim'            // a claim earlier is hedged or contradicted later
  | 'doubled_down_claim'            // an earlier hedge becomes a confident assertion later
  | 'repeated_unstated_warrant'    // the same hidden premise carries multiple arguments
  | 'shifted_framing'               // the same topic is reframed mid-argument
  | 'unresolved_counterargument'    // an objection is raised but never engaged with
  | 'consistent_strength'           // notable in the absence of failure modes
  | 'other';

export interface CrossSegmentFinding {
  kind:        CrossSegmentFindingKind;
  segmentIds:  string[];           // the segments this finding spans
  description: string;             // 1-2 sentences explaining the cross-segment pattern
  severity:    'high' | 'medium' | 'low';
  confidence:  number;
}

export interface CrossSegmentSynthesis {
  findings:       CrossSegmentFinding[];
  overallSummary: string;          // 2-3 sentence summary of the speaker's argumentative pattern
  notes:          string | null;
}

// ---------------------------------------------------------------------------
// Full result
// ---------------------------------------------------------------------------

export interface TranscriptAuditResult {
  input:         TranscriptInput;
  segmentation:  SegmentationResult;
  segmentAudits: SegmentAudit[];
  synthesis:     CrossSegmentSynthesis | null;
}

export interface TranscriptAuditDeps {
  provider:          import('../providers/types').LlmProvider;
  apiKey:            string;
  flashModel?:       string;
  proModel?:         string;
  backoffDelaysMs?:  readonly number[];
  maxParallelAudits?: number;
}
