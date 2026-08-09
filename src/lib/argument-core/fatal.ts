import type { ArgumentMap, Finding } from './schema';

/**
 * The fatal bar — when does the error tab appear.
 *
 * PROVISIONAL (Daniel, 2026-08-09): shipped as the default, pending its own
 * research round before it is final. The tab is an accusation ("There is an
 * error in this argument"), so every condition must be defensible from the
 * quote alone:
 *   1. severity high — not a quibble;
 *   2. structural — verifiable in the quoted text, never a judgment call;
 *   3. load-bearing — on the conclusion or a crux premise, not an aside.
 */
export function isFatal(f: Finding): boolean {
  return (
    f.severity === 'high' &&
    f.groundedness === 'structural' &&
    (f.location === 'conclusion' || f.location === 'crux-premise')
  );
}

export function fatalFindings(map: ArgumentMap): Finding[] {
  return map.findings.filter(isFatal);
}
