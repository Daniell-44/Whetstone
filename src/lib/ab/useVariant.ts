// ---------------------------------------------------------------------------
// useVariant — Preact hook for A/B experiment assignment.
//
// Behaviour:
//   - Synchronously returns `null` on first render (server + before cache hydrates)
//   - Calls /api/ab/assign once per (experiment, browser session), caches the
//     result in localStorage, and re-renders with the variant.
//   - Fires an `experiment_exposure` analytics event exactly once per session
//     per experiment, ONLY if the user opted into analytics.
//
// Render-pattern guidance:
//   const variant = useVariant('reader_cta_copy');
//   if (variant === null) return <ControlCopy />; // safe default while loading
//   if (variant === 'sharpen') return <SharpenCopy />;
//   return <ControlCopy />;
//
// Never branch into a delayed-render skeleton; that biases your conversion rate.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'preact/hooks';
import { track } from '../analytics/track';

const CACHE_KEY      = 'whetstone.ab_assignments';
const EXPOSED_KEY    = 'whetstone.ab_exposed';      // sessionStorage — per-tab/session
const SESSION_HASH_KEY = 'whetstone.session_hash';  // same key as analytics tracker

interface CacheShape { [experiment: string]: string }

function readCache(): CacheShape {
  if (typeof localStorage === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); } catch { return {}; }
}

function writeCache(c: CacheShape): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* quota full → silent */ }
}

function getOrCreateSessionHash(): string {
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

function markExposedOnce(experiment: string, variant: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const key = `${EXPOSED_KEY}:${experiment}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, variant);
  track('experiment_exposure', { experiment, variant });
}

export function useVariant(experimentKey: string): string | null {
  const [variant, setVariant] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return readCache()[experimentKey] ?? null;
  });

  useEffect(() => {
    if (variant) { markExposedOnce(experimentKey, variant); return; }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/ab/assign', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            experiment:  experimentKey,
            sessionHash: getOrCreateSessionHash(),
          }),
        });
        const data = await res.json() as { ok: boolean; variant?: string };
        if (cancelled || !data.ok || !data.variant) return;

        const cache = readCache();
        cache[experimentKey] = data.variant;
        writeCache(cache);
        markExposedOnce(experimentKey, data.variant);
        setVariant(data.variant);
      } catch {
        // Network failure → stay on null → caller renders control. Fine.
      }
    })();

    return () => { cancelled = true; };
  }, [experimentKey, variant]);

  return variant;
}
