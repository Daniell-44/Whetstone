import type { AuditResult } from '../../lib/audit';
import {
  wordCount,
  avgSentenceLength,
  fleschKincaidGradeLevel,
  severityBreakdown,
  totalFindingCount,
} from '../../lib/audit';

interface Props {
  result:    AuditResult;
  draftText: string;
}

export default function SummaryToolbar({ result, draftText }: Props) {
  const total    = totalFindingCount(result);
  const breakdown = severityBreakdown(result);
  const words    = wordCount(draftText);
  const avgLen   = avgSentenceLength(draftText);
  const grade    = fleschKincaidGradeLevel(draftText);

  return (
    <div class="rounded-xl border border-gray-200 bg-white px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-sm">
      {/* Left: findings summary */}
      <div class="flex items-center gap-3 flex-wrap">
        <span class="font-medium text-gray-700">
          {total} finding{total !== 1 ? 's' : ''}
        </span>
        {breakdown.high > 0 && (
          <span class="flex items-center gap-1 text-red-600">
            <span class="text-base leading-none">●</span>
            <span>{breakdown.high} high</span>
          </span>
        )}
        {breakdown.medium > 0 && (
          <span class="flex items-center gap-1 text-amber-500">
            <span class="text-base leading-none">●</span>
            <span>{breakdown.medium} medium</span>
          </span>
        )}
        {breakdown.low > 0 && (
          <span class="flex items-center gap-1 text-gray-400">
            <span class="text-base leading-none">●</span>
            <span>{breakdown.low} low</span>
          </span>
        )}
      </div>

      {/* Right: text stats */}
      <div class="flex items-center gap-3 text-gray-500 text-xs">
        <span>{words.toLocaleString()} word{words !== 1 ? 's' : ''}</span>
        <span class="text-gray-300">·</span>
        <span>~{avgLen} words/sentence</span>
        <span class="text-gray-300">·</span>
        <span>Grade {grade.toFixed(1)}</span>
      </div>
    </div>
  );
}
