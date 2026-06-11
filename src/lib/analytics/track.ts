// ---------------------------------------------------------------------------
// Client-side analytics tracker.
//
// Behaviour:
//   - Default: OFF. Tracking starts only after the user explicitly opts in.
//   - For signed-in users, consent is checked on the server via a small endpoint
//     (same opt-in flag, mirrored). For anonymous users, consent lives in
//     localStorage with the same key.
//   - Events are batched and flushed every 5s or when the page hides.
//   - Network failures are silent. We never block UI for analytics.
//   - No content text is collected. The catalogue of allowed metadata keys is
//     enforced server-side in `functions/_lib/analytics/db.ts`.
// ---------------------------------------------------------------------------

import type { AnalyticsEventName } from '../../../functions/_lib/analytics/events';

const CONSENT_KEY      = 'whetstone.analytics_consent';
const SESSION_HASH_KEY = 'whetstone.session_hash';
const FLUSH_INTERVAL   = 5_000;
const MAX_BATCH        = 20;

interface QueuedEvent {
  eventName:   AnalyticsEventName;
  sessionHash: string;
  path?:       string;
  metadata?:   Record<string, string | number | boolean>;
}

let queue: QueuedEvent[] = [];
let flushTimer: number | null = null;

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

export function getAnalyticsConsent(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'on';
}

export function setAnalyticsConsent(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  if (value) {
    localStorage.setItem(CONSENT_KEY, 'on');
  } else {
    localStorage.removeItem(CONSENT_KEY);
    queue = []; // throw away anything queued
  }
}

// ---------------------------------------------------------------------------
// Session hash — short opaque marker that rotates per browser session.
// ---------------------------------------------------------------------------

function sessionHash(): string {
  if (typeof sessionStorage === 'undefined') return 'unknown';
  let h = sessionStorage.getItem(SESSION_HASH_KEY);
  if (!h) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    h = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(SESSION_HASH_KEY, h);
  }
  return h;
}

// ---------------------------------------------------------------------------
// Public track API
// ---------------------------------------------------------------------------

export function track(
  eventName: AnalyticsEventName,
  metadata?: Record<string, string | number | boolean>,
): void {
  if (!getAnalyticsConsent()) return;
  if (typeof window === 'undefined') return;

  queue.push({
    eventName,
    sessionHash: sessionHash(),
    path:        window.location.pathname,
    metadata,
  });

  if (queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  if (flushTimer === null) {
    flushTimer = window.setTimeout(() => { void flush(); }, FLUSH_INTERVAL);
  }
}

async function flush(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await fetch('/api/analytics/track', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Silent — never block UI for analytics
  }
}

// ---------------------------------------------------------------------------
// Flush on page hide (mobile-friendly equivalent of beforeunload)
// ---------------------------------------------------------------------------

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
