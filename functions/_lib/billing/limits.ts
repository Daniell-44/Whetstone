import type { QuotaPeriod } from '../rate-limit';

// ---------------------------------------------------------------------------
// Usage limits — single source of truth.
//
// The tool is open: no account, no subscription, no tiers. Everyone gets the
// same small allowance, which opens on their first audit and closes 24 hours
// later. Signing in changes only where the count is stored (against the
// account rather than the client IP) so the allowance follows a person across
// devices instead of resetting with each new network.
//
// One audit is one use. The lenses that run off the back of an audit —
// presupposition, rhetorical mode, humility, counterargument, citation audit
// and the rest — do not spend from this allowance; each carries its own,
// far looser cap purely as a cost backstop against scripted abuse.
//
// Cost framing (approx, Gemini): a core audit + extraction ≈ $0.01, so three
// audits per visitor per day is ≈ $0.03 at full use. The cap exists to bound
// that, not to sell an upgrade.
// ---------------------------------------------------------------------------

/** Audits per rolling 24h window, for everyone. Tunable via AUDIT_FREE_USES. */
export const FREE_USE_ALLOWANCE = 3;

export interface AuditQuota {
  cap:    number;
  period: QuotaPeriod;
  /** Human label for messaging, e.g. "3 per 24 hours". */
  label:  string;
}

/**
 * Resolve the audit quota for a request.
 *
 * @param capOverride  operator override (env AUDIT_FREE_USES); ignored when
 *                     absent or not a positive number, so a malformed env var
 *                     degrades to the built-in allowance rather than to zero.
 */
export function resolveAuditQuota(capOverride?: number): AuditQuota {
  const cap = Number.isFinite(capOverride) && (capOverride as number) > 0
    ? Math.floor(capOverride as number)
    : FREE_USE_ALLOWANCE;
  return { cap, period: 'rolling24h', label: `${cap} per 24 hours` };
}

/**
 * How long until the allowance reopens, phrased for a person rather than a log.
 * Falls back to a vague-but-true phrase if `resetAt` is unparseable.
 */
export function waitPhrase(resetAtIso: string, nowMs: number = Date.now()): string {
  const ms = Date.parse(resetAtIso) - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return 'shortly';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? '' : 's'}`;
}
