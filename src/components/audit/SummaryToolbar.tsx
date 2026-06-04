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

// ---------------------------------------------------------------------------
// Score ring — circular progress indicator (SVG)
// ---------------------------------------------------------------------------

function ScoreRing({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const colour = score >= 80 ? '#22c55e'   // green
    : score >= 60 ? '#f59e0b'              // amber
    : score >= 40 ? '#f97316'              // orange
    : '#ef4444';                           // red

  return (
    <div class="relative inline-flex items-center justify-center" style={{ width: '52px', height: '52px' }}>
      <svg width="52" height="52" class="-rotate-90">
        {/* Background circle */}
        <circle cx="26" cy="26" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="4" />
        {/* Progress arc */}
        <circle
          cx="26" cy="26" r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <span class="absolute text-sm font-bold" style={{ color: colour }}>
        {score}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score label
// ---------------------------------------------------------------------------

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Needs work';
  return 'Significant issues';
}

// ---------------------------------------------------------------------------
// Main toolbar
// ---------------------------------------------------------------------------

interface Props {
  result:     AuditResult;
  draftText:  string;
  draftTitle?: string;
}

export default function SummaryToolbar({ result, draftText, draftTitle }: Props) {
  const [copied, setCopied] = useState(false);
  const total     = totalFindingCount(result);
  const breakdown = severityBreakdown(result);
  const words     = wordCount(draftText);
  const avgLen    = avgSentenceLength(draftText);
  const grade     = fleschKincaidGradeLevel(draftText);
  const score     = argumentScore(result);

  return (
    <div class="rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center gap-5">
      {/* Score ring */}
      <div class="flex items-center gap-3 shrink-0">
        <ScoreRing score={score} />
        <div>
          <p class="text-xs font-semibold text-gray-700">{scoreLabel(score)}</p>
          <p class="text-[10px] text-gray-400">Argument quality</p>
        </div>
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

      {/* Text stats + export */}
      <div class="flex items-center gap-3 text-gray-400 text-[10px] shrink-0">
        <span>{words.toLocaleString()} words</span>
        <span>·</span>
        <span>~{avgLen} w/s</span>
        <span>·</span>
        <span>Grade {grade.toFixed(1)}</span>

        <div class="h-4 w-px bg-gray-200 mx-1" />

        <button
          onClick={() => {
            const md = auditToMarkdown(result, draftTitle);
            navigator.clipboard.writeText(md).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          class="px-2 py-1 rounded text-[10px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
          class="px-2 py-1 rounded text-[10px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Download audit report as .md file"
        >
          ↓ Download
        </button>
      </div>
    </div>
  );
}
