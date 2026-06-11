import type { QuotaPeriod } from '../rate-limit';

// ---------------------------------------------------------------------------
// Tier-based usage limits — single source of truth.
//
// Free:
//   - Anonymous (no account): 3 audits/day, IP-keyed
//   - Signed-in free:         5 audits/day, user-keyed
//
// Paid (Solo / Studio):
//   - 100 audits/month per subscription block.
//   - "Buy more": a user can increase their Stripe subscription quantity;
//     the monthly cap is 100 × quantity. (Quantity wiring is a follow-up;
//     blockMultiplier defaults to 1 today.)
//
// Cost framing (approx, Gemini): a core audit + extraction ≈ $0.01.
// 100 audits/month ≈ $1 cost against an A$33 sub → comfortable margin even
// before considering that most users never approach the cap. The hard cap
// is what protects against a power user costing more than they pay.
// ---------------------------------------------------------------------------

export const FREE_ANON_DAILY_AUDIT_CAP   = 3;
export const FREE_SIGNED_DAILY_AUDIT_CAP = 5;
export const PAID_MONTHLY_AUDIT_BLOCK    = 100;

export interface AuditQuota {
  cap:    number;
  period: QuotaPeriod;
  /** Human label for messaging, e.g. "5 per day" / "100 per month". */
  label:  string;
}

/**
 * Resolve the audit quota for a request.
 *
 * @param signedIn         whether a user session exists
 * @param hasSubscription  whether the user (or their workspace) has an active sub
 * @param blockMultiplier  number of purchased blocks (Stripe quantity); default 1
 */
export function resolveAuditQuota(
  signedIn:        boolean,
  hasSubscription: boolean,
  blockMultiplier: number = 1,
): AuditQuota {
  if (hasSubscription) {
    const cap = PAID_MONTHLY_AUDIT_BLOCK * Math.max(1, blockMultiplier);
    return { cap, period: 'month', label: `${cap} per month` };
  }
  if (signedIn) {
    return { cap: FREE_SIGNED_DAILY_AUDIT_CAP, period: 'day', label: `${FREE_SIGNED_DAILY_AUDIT_CAP} per day` };
  }
  return { cap: FREE_ANON_DAILY_AUDIT_CAP, period: 'day', label: `${FREE_ANON_DAILY_AUDIT_CAP} per day` };
}
