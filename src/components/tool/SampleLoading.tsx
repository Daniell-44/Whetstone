// Honest loading state for pre-cached sample loads: the result was computed
// ahead of time, so there is no progress bar and no 10-20 second estimate.
// Live audits keep AuditLoading (eased bar + skeleton); do not merge the two,
// the whole point is that they read differently.
export default function SampleLoading() {
  return (
    <div class="rounded-xl border border-hairline bg-surface px-4 py-3">
      <p class="text-sm font-medium text-ink">Loading pre-computed sample…</p>
      <p class="text-xs text-muted mt-1">This example was audited ahead of time, so there is no engine wait.</p>
    </div>
  );
}
