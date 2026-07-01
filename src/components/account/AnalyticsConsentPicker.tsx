import { useState, useEffect } from 'preact/hooks';
import { getAnalyticsConsent, setAnalyticsConsent } from '../../lib/analytics/track';

export default function AnalyticsConsentPicker() {
  const [on, setOn]   = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOn(getAnalyticsConsent());
    setReady(true);
  }, []);

  if (!ready) return null;

  const toggle = () => {
    const next = !on;
    setOn(next);
    setAnalyticsConsent(next);
  };

  return (
    <div class="space-y-3">
      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          onChange={toggle}
          class="mt-0.5 h-4 w-4 rounded accent-accent shrink-0"
        />
        <div>
          <p class="text-sm text-ink font-medium">Help improve The Whetstone</p>
          <p class="text-xs text-muted mt-0.5 leading-relaxed">
            Opt in to anonymous product-event analytics. Whitelisted event names + metadata only.
            No text content, no IP storage, no third parties. Toggle off anytime; we throw away any queued events.
          </p>
        </div>
      </label>
      {on && (
        <p class="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 leading-relaxed">
          Tracking on. Events like <code class="font-mono">audit_completed</code> and <code class="font-mono">sample_picked</code>
          are sent so we can see what's used and what isn't.{' '}
          <a href="/privacy" class="underline font-medium">Privacy policy →</a>
        </p>
      )}
    </div>
  );
}
