import type { ArgumentMap, Finding } from './schema';

/**
 * The fatal bar — when does the error tab appear.
 *
 * v2 (2026-08-09, after the threshold research round — Research_Fatal_Bar_v1
 * .md): the tab is an accusation ("There is an error in this argument"), and
 * the research across NewsGuard / IFCN fact-checkers / Community Notes /
 * Wikipedia is unanimous that wrongful flags cost more than silence. Every
 * condition must be defensible from the quote alone:
 *   1. severity high — not a quibble;
 *   2. structural — verifiable in the quoted text, never a judgment call
 *      (this is also what excludes values/prediction/intent disputes);
 *   3. load-bearing — on the conclusion or a crux premise, not an aside;
 *   4. calibrated — when the engine emits a confidence value it must clear
 *      CONFIDENCE_FLOOR; an absent value leaves the categorical conditions
 *      standing alone (strictly more conservative than v1, never less).
 * Below the bar, findings fold quietly behind "the full audit ⌄" — that is
 * the research's "context note" tier. Daniel ratifies the final bar.
 */
export const CONFIDENCE_FLOOR = 0.85;

export function isFatal(f: Finding): boolean {
  return (
    f.severity === 'high' &&
    f.groundedness === 'structural' &&
    (f.location === 'conclusion' || f.location === 'crux-premise') &&
    (f.confidence === undefined || f.confidence >= CONFIDENCE_FLOOR)
  );
}

export function fatalFindings(map: ArgumentMap): Finding[] {
  return map.findings.filter(isFatal);
}
