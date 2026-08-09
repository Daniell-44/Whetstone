import type { Skeleton, Finding, Warrant, Premise, InferenceLink } from './schema';
import { locateQuote } from './locate';

/**
 * Adapters from the site's live engines into the shared contract.
 *
 * The input types here are STRUCTURAL — they match the shapes of the site's
 * extraction and audit results (and the extension's synced copies) without
 * importing either, so both toolchains can feed the adapters their own
 * result objects.
 */

export interface ExtractionStatementLike {
  id: string;
  type: 'premise' | 'conclusion';
  text: string;
  derivedFrom?: string[] | null;
  inferenceRule?: string | null;
  inferenceRuleExplanation?: string | null;
}

export interface ExtractionLike {
  centralClaim: string;
  statements: ExtractionStatementLike[];
}

/**
 * Skeleton from an argument extraction. Crux inference: premises the
 * conclusion(s) directly rest on (their derivedFrom parents) are load-bearing.
 */
export function skeletonFromExtraction(x: ExtractionLike): Skeleton {
  const conclusions = x.statements.filter((s) => s.type === 'conclusion');
  const directParents = new Set(conclusions.flatMap((c) => c.derivedFrom ?? []));

  const premises: Premise[] = x.statements
    .filter((s) => s.type === 'premise')
    .map((s) => ({
      id: s.id,
      text: s.text,
      tag: 'stated' as const,
      ...(directParents.has(s.id) ? { crux: true } : {}),
    }));

  const links: InferenceLink[] = x.statements
    .filter((s) => (s.derivedFrom?.length ?? 0) > 0 && s.inferenceRule)
    .map((s) => ({
      from: s.derivedFrom as string[],
      to: s.type === 'conclusion' ? 'C' : s.id,
      rule: String(s.inferenceRule).replace(/_/g, ' '),
      ...(s.inferenceRuleExplanation ? { note: s.inferenceRuleExplanation } : {}),
    }));

  const claims = [
    x.centralClaim,
    ...conclusions.map((c) => c.text).filter((t) => t !== x.centralClaim),
  ];

  return { claims, premises, links, warrants: [] };
}

export interface AuditFallacyLike {
  name: string;
  quote: string;
  explanation: string;
  severity: 'high' | 'medium' | 'low';
  groundedness: { kind: 'structural' | 'interpretive' | 'empirical' };
}

export interface AuditWarrantLike {
  warrant: string;
  necessity: string;
}

export interface AuditLike {
  namedFallacies: AuditFallacyLike[];
  toulmin?: { unstatedWarrants: AuditWarrantLike[] } | null;
}

/**
 * Findings from an audit result. P1 scope: named fallacies only — they carry
 * the verbatim quote the fatal bar's location condition needs. The phase-2
 * lenses join once their evidence fields get the same treatment.
 */
export function findingsFromAudit(a: AuditLike, skeleton: Skeleton): Finding[] {
  return a.namedFallacies.map((f) => ({
    name: f.name,
    quote: f.quote,
    explanation: f.explanation,
    severity: f.severity,
    groundedness: f.groundedness.kind,
    location: locateQuote(f.quote, skeleton),
  }));
}

export function warrantsFromAudit(a: AuditLike): Warrant[] {
  return (a.toulmin?.unstatedWarrants ?? []).map((w) => ({
    text: w.warrant,
    necessity: w.necessity,
  }));
}
