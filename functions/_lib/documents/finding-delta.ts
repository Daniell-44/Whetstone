import type { AuditResult } from '../audit/types';
import {
  fallacyMatchKey,
  loadedLanguageMatchKey,
  unstatedWarrantMatchKey,
  keyTermMatchKey,
  referentMatchKey,
  falsifiabilityMatchKey,
  modalScopeMatchKey,
} from '../audit/match-keys';

// ---------------------------------------------------------------------------
// Finding delta between two audit runs of the same document.
//
// Pure module: no I/O, no LLM. A finding is "the same finding" across runs
// when its match key matches — the keys combine the lens/kind with the
// normalised quoted text (see audit/match-keys.ts), which is exactly the
// "quote + lens/kind" identity the re-audit delta needs. Counts only; the
// full structural diff lives in documents/diff.ts.
// ---------------------------------------------------------------------------

export interface FindingDelta {
  /** Findings present in the new audit but not the previous one. */
  newFindings: number;
  /** Findings present in the previous audit but absent from the new one. */
  resolved:    number;
}

/** Flatten every finding in an AuditResult to its stable match key. */
export function auditFindingKeys(audit: AuditResult): Set<string> {
  const keys = new Set<string>();
  for (const f of audit.namedFallacies       ?? []) keys.add(fallacyMatchKey(f));
  for (const l of audit.loadedLanguage       ?? []) keys.add(loadedLanguageMatchKey(l));
  for (const w of audit.toulmin?.unstatedWarrants ?? []) keys.add(unstatedWarrantMatchKey(w));
  for (const k of audit.keyTermScrutiny      ?? []) keys.add(keyTermMatchKey(k));
  for (const r of audit.referentChecks       ?? []) keys.add(referentMatchKey(r));
  for (const f of audit.falsifiabilityChecks ?? []) keys.add(falsifiabilityMatchKey(f));
  for (const m of audit.modalScopeChecks     ?? []) keys.add(modalScopeMatchKey(m));
  return keys;
}

/**
 * Compare two audits of the same document. `previous` may be null (first
 * audit): every finding in `next` counts as new and nothing is resolved.
 */
export function computeFindingDelta(previous: AuditResult | null, next: AuditResult): FindingDelta {
  const nextKeys = auditFindingKeys(next);
  if (!previous) return { newFindings: nextKeys.size, resolved: 0 };

  const prevKeys = auditFindingKeys(previous);
  let newFindings = 0;
  let resolved    = 0;
  for (const k of nextKeys) if (!prevKeys.has(k)) newFindings++;
  for (const k of prevKeys) if (!nextKeys.has(k)) resolved++;
  return { newFindings, resolved };
}

/** JSON-string convenience wrapper for callers holding raw db columns. */
export function computeFindingDeltaFromJson(previousJson: string | null, nextJson: string): FindingDelta {
  const previous = previousJson ? (JSON.parse(previousJson) as AuditResult) : null;
  const next     = JSON.parse(nextJson) as AuditResult;
  return computeFindingDelta(previous, next);
}
