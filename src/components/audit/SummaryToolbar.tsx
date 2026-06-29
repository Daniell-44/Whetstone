import { useState } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import {
  wordCount,
  avgSentenceLength,
  fleschKincaidGradeLevel,
  severityBreakdown,
  totalFindingCount,
  argumentScore,
} from '../../lib/audit';
import { auditToMarkdown, downloadMarkdown } from '../../lib/export-audit';
import { track } from '../../lib/analytics/track';

// ---------------------------------------------------------------------------
// Overall assessment band — a categorical label, NOT a 0–100 score. A precise
// "20/100" implies a calibrated metric the audit doesn't actually have and
// reads as misleading; the honest signal is the severity breakdown below. The
// band just buckets it into plain language.
// ---------------------------------------------------------------------------

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Needs work';
  return 'Significant issues';
}

function bandStyle(score: number): string {
  if (score >= 75) return 'bg-emerald-100 text-emerald-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  if (score >= 40) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

// ---------------------------------------------------------------------------
// Main toolbar
// ---------------------------------------------------------------------------

interface Props {
  result:     AuditResult;
  draftText:  string;
  draftTitle?: string;
}

type ShareState =
  | { status: 'idle' }
  | { status: 'sharing' }
  | { status: 'shared'; url: string }
  | { status: 'error' };

export default function SummaryToolbar({ result, draftText, draftTitle }: Props) {
  const [copied, setCopied]   = useState(false);
  const [share, setShare]     = useState<ShareState>({ status: 'idle' });

  async function handleShare() {
    setShare({ status: 'sharing' });
    try {
      const res = await fetch('/api/audit-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ audit: result, draftText, draftTitle }),
      });
      const data = await res.json() as { ok: boolean; url?: string };
      if (data.ok && data.url) {
        await navigator.clipboard.writeText(data.url);
        setShare({ status: 'shared', url: data.url });
        track('audit_share_link_created');
        setTimeout(() => setShare({ status: 'idle' }), 3000);
      } else {
        setShare({ status: 'error' });
        setTimeout(() => setShare({ status: 'idle' }), 3000);
      }
    } catch {
      setShare({ status: 'error' });
      setTimeout(() => setShare({ status: 'idle' }), 3000);
    }
  }
  const total     = totalFindingCount(result);
  const breakdown = severityBreakdown(result);
  const words     = wordCount(draftText);
  const avgLen    = avgSentenceLength(draftText);
  const grade     = fleschKincaidGradeLevel(draftText);
  const score     = argumentScore(result);

  return (
    <div class="rounded-lg border border-gray-200 bg-white px-3 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* Overall assessment — categorical band, not a misleading 0–100 number */}
      <div class="flex items-center shrink-0">
        <span class={`px-2.5 py-1 rounded-full text-xs font-semibold ${bandStyle(score)}`}>{scoreLabel(score)}</span>
      </div>

      <div class="h-8 w-px bg-gray-200 shrink-0" />

      {/* Findings summary */}
      <div class="flex items-center gap-3 flex-wrap flex-1">
        <span class="text-sm font-medium text-gray-700">
          {total} finding{total !== 1 ? 's' : ''}
        </span>
        {breakdown.high > 0 && (
          <span class="flex items-center gap-1 text-red-600 text-xs">
            <span class="text-base leading-none">●</span>
            {breakdown.high} high
          </span>
        )}
        {breakdown.medium > 0 && (
          <span class="flex items-center gap-1 text-amber-500 text-xs">
            <span class="text-base leading-none">●</span>
            {breakdown.medium} medium
          </span>
        )}
        {breakdown.low > 0 && (
          <span class="flex items-center gap-1 text-gray-400 text-xs">
            <span class="text-base leading-none">●</span>
            {breakdown.low} low
          </span>
        )}
      </div>

      {/* Text stats */}
      <div class="flex items-center gap-x-2 gap-y-1 text-gray-400 text-xs min-w-0 flex-wrap">
        <span>{words.toLocaleString()} words</span>
        <span>·</span>
        <span>~{avgLen} w/s</span>
        <span>·</span>
        <span>Grade {grade.toFixed(1)}</span>
      </div>

      {/* Export actions — kept together in one group so "Share audit" never
         wraps onto its own orphaned line. */}
      <div class="flex items-center gap-1 ml-auto shrink-0">
        <button
          onClick={() => {
            const md = auditToMarkdown(result, draftTitle);
            navigator.clipboard.writeText(md).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          class="px-2 py-1 rounded text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Copy audit report as markdown"
        >
          {copied ? '✓ Copied' : 'Copy report'}
        </button>
        <button
          onClick={() => {
            const md = auditToMarkdown(result, draftTitle);
            const safeName = (draftTitle ?? 'audit').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
            downloadMarkdown(md, `whetstone-${safeName}.md`);
          }}
          class="px-2 py-1 rounded text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Download audit report as .md file"
        >
          ↓ Download
        </button>
        <button
          onClick={() => void handleShare()}
          disabled={share.status === 'sharing'}
          class={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            share.status === 'shared'
              ? 'text-emerald-600 bg-emerald-50'
              : share.status === 'error'
                ? 'text-red-600 bg-red-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          } disabled:opacity-60`}
          title="Create a shareable permalink (30-day expiry). Auto-copies to clipboard."
        >
          {share.status === 'sharing' ? 'Sharing…' :
           share.status === 'shared'  ? '🔗 Link copied' :
           share.status === 'error'   ? 'Failed' :
                                        '🔗 Share audit'}
        </button>
      </div>
    </div>
  );
}
