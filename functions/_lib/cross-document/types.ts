import type { AuditResult } from '../audit/types';
import type { ArgumentExtractionResult } from '../argument-extraction/types';

// ---------------------------------------------------------------------------
// Cross-document audit.
//
// Audits 2–5 documents (by the same author, or on the same topic) and runs a
// synthesis pass to find patterns ACROSS them that no single-document audit
// can see:
//   - a claim asserted in one piece that's contradicted in another
//   - a warrant relied on repeatedly but never defended in any piece
//   - a position that shifts across the corpus without acknowledgement
//   - consistent strengths (notable in the absence of failure modes)
//
// Use case: scrutinising a pundit / commentator / politician for internal
// consistency across their published positions.
// ---------------------------------------------------------------------------

export interface DocumentInput {
  id:         string;          // stable id, e.g. 'doc-1'
  label:      string;          // user-facing label (title, URL, or "Document 1")
  sourceUrl:  string | null;   // URL if fetched
  text:       string;          // the document body
}

export interface DocumentAudit {
  documentId:  string;
  label:       string;
  audit:       AuditResult;
  extraction:  ArgumentExtractionResult;
}

// ---------------------------------------------------------------------------
// Cross-document synthesis findings
// ---------------------------------------------------------------------------

export type CrossDocumentFindingKind =
  | 'self_contradiction'        // a claim in one doc contradicts a claim in another
  | 'repeated_unstated_warrant' // the same hidden premise carries arguments across docs
  | 'shifted_position'          // a position changes across docs without acknowledgement
  | 'escalating_certainty'      // a hedged claim in one doc becomes confident in another
  | 'consistent_strength'       // a notable consistency / rigour across the corpus
  | 'selective_standard'        // a standard applied to opponents but not to the author's side
  | 'other';

export interface CrossDocumentFinding {
  kind:          CrossDocumentFindingKind;
  documentIds:   string[];      // the documents this finding spans (2+)
  description:   string;        // 2-3 sentences explaining the cross-document pattern
  evidence:      CrossDocEvidence[]; // verbatim quotes from each implicated document
  severity:      'high' | 'medium' | 'low';
  confidence:    number;        // 0-100
}

export interface CrossDocEvidence {
  documentId: string;
  quote:      string;           // verbatim substring from that document
}

export interface CrossDocumentSynthesis {
  findings:        CrossDocumentFinding[];
  overallPattern:  string;      // 2-3 sentences characterising the author's cross-corpus argumentative pattern
  notes:           string | null;
}

// ---------------------------------------------------------------------------
// Full result
// ---------------------------------------------------------------------------

export interface CrossDocumentResult {
  documents:       DocumentInput[];   // inputs (text trimmed to a preview length for storage)
  documentAudits:  DocumentAudit[];
  synthesis:       CrossDocumentSynthesis | null;
}

export interface CrossDocumentDeps {
  provider:          import('../providers/types').LlmProvider;
  apiKey:            string;
  flashModel?:       string;
  proModel?:         string;
  backoffDelaysMs?:  readonly number[];
  maxParallelAudits?: number;
}
