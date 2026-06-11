import type { AuditResult } from '../../../functions/_lib/audit/types';
import type { ArgumentExtractionResult } from '../../../functions/_lib/argument-extraction/types';

// A sample is a curated draft + pre-computed engine outputs.
// Loaded instantly when the user picks one in Studio — no API cost, no wait.
// Marked as "cached" in the UI to distinguish from live runs.
// Re-run the engine via npm run regen:samples when prompts change.

export interface Sample {
  id:            string;
  title:         string;
  category:      string;
  shortLabel:    string;       // e.g. "Helmets op-ed"
  failureModes:  string[];     // e.g. ["false dichotomy", "appeal to emotion"]
  text:          string;
  cached: {
    audit:       AuditResult;
    extraction:  ArgumentExtractionResult;
  };
}

// Hash a text to a short signature for dirty-tracking.
// Cheap deterministic hash — used to detect "is this still the sample I loaded?"
export function sampleSignature(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return `${text.length}:${h}`;
}
