import { FREE_USE_ALLOWANCE } from '../../../functions/_lib/billing/limits';

export interface Allowance {
  remaining: number;
  cap:       number;
  resetAt:   string;
}

// ---------------------------------------------------------------------------
// The rule, stated before it bites.
//
// The allowance was previously invisible until it refused someone — which
// reads as a trick rather than a rule. Someone who knows they have three
// rations them; someone who finds out on the fourth attempt feels cheated.
//
// Before the first audit we show the cap from the shared constant. After one,
// the server tells us what is actually left (it knows; the client cannot).
// ---------------------------------------------------------------------------

export default function AllowanceNote({ allowance }: { allowance?: Allowance | null }) {
  if (!allowance) {
    return (
      <p class="text-xs text-muted leading-relaxed">
        {FREE_USE_ALLOWANCE} audits every 24 hours — no account needed for any of it.
      </p>
    );
  }

  const { remaining, cap } = allowance;

  if (remaining === 0) {
    // The refusal message itself carries the reopening time; don't repeat it.
    return (
      <p class="text-xs text-accent leading-relaxed">
        That was your last of {cap} for now.
      </p>
    );
  }

  return (
    <p class="text-xs text-muted leading-relaxed">
      <span class="font-semibold text-ink">{remaining}</span>
      {remaining === 1 ? ' audit left' : ' audits left'} of {cap} — the window reopens 24 hours
      after your first one.
    </p>
  );
}
