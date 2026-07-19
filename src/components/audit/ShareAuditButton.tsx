import { useState } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import { track } from '../../lib/analytics/track';
import { truncateForShare } from './reader-helpers';

// ---------------------------------------------------------------------------
// ShareAuditButton - compact "Share audit" pill for the Reader's verdict bar.
// POSTs the whole result to /api/audit-link (anonymous, KV-backed, 30-day
// TTL), copies the returned permalink, and confirms inline. The per-finding
// SVG cards remain the finding-level share; this is the whole-audit one.
// ---------------------------------------------------------------------------

type ShareState =
  | { status: 'idle' }
  | { status: 'sharing' }
  // copied=false when the clipboard write was blocked: keep the URL on screen
  // so the user can copy it by hand instead of silently losing the link.
  | { status: 'shared'; url: string; copied: boolean }
  | { status: 'error' };

export default function ShareAuditButton({ result, draftText }: { result: AuditResult; draftText: string }) {
  const [share, setShare] = useState<ShareState>({ status: 'idle' });

  async function handleShare() {
    if (share.status === 'sharing') return;
    setShare({ status: 'sharing' });
    try {
      const res = await fetch('/api/audit-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ audit: result, draftText: truncateForShare(draftText) }),
      });
      const data = await res.json() as { ok: boolean; url?: string };
      if (data.ok && data.url) {
        let copied = true;
        try {
          await navigator.clipboard.writeText(data.url);
        } catch {
          copied = false;
        }
        setShare({ status: 'shared', url: data.url, copied });
        track('audit_share_link_created');
        // Only auto-revert when the confirmation has done its job; a visible
        // manual-copy URL should stay until the user moves on.
        if (copied) window.setTimeout(() => setShare({ status: 'idle' }), 4000);
      } else {
        setShare({ status: 'error' });
        window.setTimeout(() => setShare({ status: 'idle' }), 4000);
      }
    } catch {
      setShare({ status: 'error' });
      window.setTimeout(() => setShare({ status: 'idle' }), 4000);
    }
  }

  return (
    <div class="flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={share.status === 'sharing'}
        title="Create a shareable link to this audit"
        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-hairline text-xs font-medium text-ink hover:border-accent-support hover:text-accent-support transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        {share.status === 'sharing' ? 'Creating link…' : 'Share audit'}
      </button>
      {share.status === 'shared' && share.copied && (
        <span class="text-xs text-factual" role="status">Link copied. Expires in 30 days.</span>
      )}
      {share.status === 'shared' && !share.copied && (
        <span class="text-xs text-muted min-w-0 truncate" role="status">
          Copy it: <a href={share.url} class="underline text-accent-support">{share.url}</a>
        </span>
      )}
      {share.status === 'error' && (
        <span class="text-xs text-muted" role="status">Could not create the link. Try again.</span>
      )}
    </div>
  );
}
