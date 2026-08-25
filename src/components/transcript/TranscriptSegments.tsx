import type { PickableSegment } from '../../../functions/_lib/transcript/segment-handler';

// ---------------------------------------------------------------------------
// The transcript map.
//
// Replaces the Transcript room at /creator/studio/transcript (owner call
// 2026-08-25, on cost). That page ran segmentation, then up to twelve
// per-segment audits, then a gemini-2.5-pro synthesis, for one click. This
// shows the map for a single Flash call and lets the reader spend one ordinary
// audit on the passage they care about.
//
// Rule 13: it does not add a view, it replaces a page and a nav tab.
// ---------------------------------------------------------------------------

export function timeRange(startSec: number, endSec: number): string {
  const stamp = (s: number) => {
    const total = Math.max(0, Math.round(s));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
  };
  // A pasted transcript with no timings has every cue at zero, so a range of
  // 0:00 to 0:00 would be noise dressed as data.
  if (startSec <= 0 && endSec <= 0) return '';
  return `${stamp(startSec)} - ${stamp(endSec)}`;
}

interface Props {
  segments: PickableSegment[];
  title:    string | null;
  excluded: { count: number; total: number };
  /** Runs the ordinary audit on this segment's verbatim text. */
  onPick:   (segment: PickableSegment) => void;
  /** Clears the map and returns the field to a fresh paste. */
  onReset:  () => void;
}

export default function TranscriptSegments({ segments, title, excluded, onPick, onReset }: Props) {
  return (
    <section class="rounded-xl border border-hairline bg-surface overflow-hidden">
      <header class="px-5 py-4 border-b border-hairline">
        <p class="font-mono text-[13px] uppercase tracking-[0.08em] text-muted mb-1">Transcript</p>
        {title && <h2 class="font-serif text-[20px] text-ink-strong leading-snug mb-1">{title}</h2>}
        <p class="text-[15px] text-muted leading-relaxed">
          {segments.length === 0
            ? 'Nothing in this transcript reads as an argument being made and defended.'
            : `${segments.length} ${segments.length === 1 ? 'passage' : 'passages'} where someone argues for something. Pick one to audit it.`}
          {excluded.count > 0 && (
            <> {excluded.count} of {excluded.total} {excluded.total === 1 ? 'passage was' : 'passages were'} set aside as introductions, sponsor reads, stories or banter.</>
          )}
        </p>
        {/* The reader is about to choose based on a machine's paraphrase, so
           say that before they choose, not after. */}
        <p class="text-[13px] text-muted leading-relaxed mt-2">
          The summaries below are the engine describing what it heard, not quotes. The audit runs on
          the transcript words themselves.
        </p>
      </header>

      {segments.length > 0 && (
        <ul class="divide-y divide-hairline">
          {segments.map((s) => {
            const range = timeRange(s.startSec, s.endSec);
            return (
              <li key={s.id}>
                <div class="flex items-start gap-4 px-5 py-4">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      {range && <span class="font-mono text-[13px] text-muted shrink-0">{range}</span>}
                      {range && <span class="text-hairline" aria-hidden="true">·</span>}
                      <span class="font-mono text-[13px] text-muted shrink-0">{s.words.toLocaleString()} words</span>
                    </div>
                    <p class="font-serif text-[17px] text-ink leading-snug">{s.claimSummary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPick(s)}
                    class="shrink-0 min-h-11 inline-flex items-center rounded-lg border border-accent-support/40 px-4 text-[15px] font-semibold text-accent-support hover:bg-accent-support/5 transition-colors"
                  >
                    Audit this
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer class="px-5 py-3 border-t border-hairline bg-paper">
        <button
          type="button"
          onClick={onReset}
          class="text-[13px] text-muted hover:text-ink transition-colors"
        >
          Use a different transcript
        </button>
      </footer>
    </section>
  );
}
