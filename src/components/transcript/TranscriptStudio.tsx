import { useState } from 'preact/hooks';
import type { TranscriptAuditResult, ArgumentSegment, SegmentAudit, CrossSegmentFinding } from '../../../functions/_lib/transcript/types';
import AuditResults from '../audit/AuditResults';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import { track } from '../../lib/analytics/track';

type Phase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: TranscriptAuditResult }
  | { status: 'error'; message: string };

type Tab = 'youtube' | 'text' | 'srt';

// The engine emits a 0-100 confidence, but the product removed numeric
// confidence on principle (categorical groundedness replaced it) — these two
// paid rooms were the last surfaces still leaking the raw number. Render a
// categorical band instead so the brand rule holds.
function confBand(n: number): string {
  return n >= 80 ? 'high confidence' : n >= 50 ? 'moderate confidence' : 'low confidence';
}

const SAMPLE_TEXT = `So the question I want to address today is whether mandatory bicycle helmet laws are actually good public health policy. And I think most people who haven't really thought about this assume the answer is obviously yes - helmets save lives, more helmets, more lives saved. But I think the empirical record is much more complicated than that.

When Australia introduced its mandatory helmet law in 1991, cycling participation dropped by something like 30 to 40 percent depending on which study you look at. And what happens when fewer people are cycling? Well, drivers become less aware of cyclists, and per-cyclist injury rates actually went up in some Australian cities. So you have to weigh the harm reduction from helmets against the harm increase from reduced cycling.

Now critics will say, well, that's just one country. But the pattern repeats. The Netherlands, which has the lowest cyclist death rate per capita in the developed world, has no helmet law. Helmet use is around five percent. What they have instead is infrastructure - protected bike lanes everywhere. So the question becomes, why are we mandating helmets instead of building infrastructure?

The standard reply is that infrastructure is expensive and helmet laws are cheap. But I think this is a category error. The infrastructure investment pays back in ways that compound - more cycling means healthier population, less traffic congestion, lower transportation emissions. Helmet laws are a band-aid; infrastructure addresses the underlying conditions.`;

export default function TranscriptStudio() {
  const [tab, setTab]               = useState<Tab>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [text, setText]             = useState('');
  const [srt, setSrt]               = useState('');
  const [title, setTitle]           = useState('');
  const [phase, setPhase]           = useState<Phase>({ status: 'idle' });

  const canSubmit =
    phase.status !== 'loading' && (
      (tab === 'youtube' && youtubeUrl.trim().startsWith('http')) ||
      (tab === 'text'    && text.trim().length >= 200) ||
      (tab === 'srt'     && srt.trim().length >= 50)
    );

  async function handleSubmit() {
    setPhase({ status: 'loading' });
    const startedAt = performance.now();
    track('transcript_audit_started', { kind: tab });
    try {
      const body =
        tab === 'youtube' ? { kind: 'youtube' as const, url: youtubeUrl.trim(), title: title.trim() || undefined } :
        tab === 'text'    ? { kind: 'text' as const,    text: text.trim(),       title: title.trim() || undefined } :
                            { kind: 'srt' as const,     srt:  srt.trim(),        title: title.trim() || undefined };

      const res = await fetch('/api/transcript-audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as
        | { ok: true; result: TranscriptAuditResult }
        | { ok: false; error: { code: string; message: string } };

      if (data.ok) {
        setPhase({ status: 'done', result: data.result });
        track('transcript_audit_completed', {
          latency_ms:    Math.round(performance.now() - startedAt),
          segment_count: data.result.segmentation.argumentCount,
        });
      } else {
        setPhase({ status: 'error', message: data.error.message });
      }
    } catch {
      setPhase({ status: 'error', message: 'Network error.' });
    }
  }

  return (
    <div class="space-y-6">

      {/* Input */}
      <div class="rounded-xl border border-amber-200 bg-surface p-5 sm:p-6 space-y-4">

        {/* Tab switcher */}
        <div class="flex gap-1 p-1 bg-hairline/40 rounded-lg w-fit">
          {(['youtube', 'text', 'srt'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              class={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-surface text-ink-strong shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t === 'youtube' ? 'YouTube URL' : t === 'text' ? 'Paste transcript' : 'Paste SRT'}
            </button>
          ))}
        </div>

        {/* Optional title */}
        <div>
          <label class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5 block">
            Title (optional)
          </label>
          <input
            type="text"
            value={title}
            onInput={e => setTitle((e.target as HTMLInputElement).value)}
            placeholder="e.g. Joe Rogan on AI doomerism"
            class="w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {/* Input based on tab */}
        {tab === 'youtube' && (
          <div>
            <label class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5 block">
              YouTube URL
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onInput={e => setYoutubeUrl((e.target as HTMLInputElement).value)}
              placeholder="https://www.youtube.com/watch?v=..."
              class="w-full rounded-lg border border-hairline bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <p class="text-xs text-muted mt-1.5">
              We'll fetch the public caption track. Doesn't work for private, age-restricted, or captions-off videos. Paste the transcript instead in that case.
            </p>
          </div>
        )}

        {tab === 'text' && (
          <div>
            <label class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5 block">
              Transcript text
            </label>
            <textarea
              value={text}
              onInput={e => setText((e.target as HTMLTextAreaElement).value)}
              placeholder="Paste a transcript here - any length up to ~60,000 characters (about a 1-hour podcast)."
              rows={10}
              class="w-full rounded-lg border border-hairline bg-paper px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <div class="flex items-center justify-between mt-1.5 text-xs">
              <button
                type="button"
                onClick={() => setText(SAMPLE_TEXT)}
                class="text-amber-600 hover:text-amber-800 font-medium"
              >
                Try with a sample (helmet policy podcast clip)
              </button>
              <span class="text-muted tabular-nums">{text.length.toLocaleString()} chars</span>
            </div>
          </div>
        )}

        {tab === 'srt' && (
          <div>
            <label class="text-xs font-semibold uppercase tracking-widest text-muted mb-1.5 block">
              SRT / VTT captions
            </label>
            <textarea
              value={srt}
              onInput={e => setSrt((e.target as HTMLTextAreaElement).value)}
              placeholder={`1\n00:00:01,000 --> 00:00:05,000\nSubtitle text here\n\n2\n...`}
              rows={10}
              class="w-full rounded-lg border border-hairline bg-paper px-3 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <p class="text-xs text-muted mt-1.5">
              Preserves timestamps so cross-segment analysis can reference times.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          class={`w-full py-3 px-6 rounded-lg text-sm font-semibold transition-colors ${
            canSubmit
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-hairline/40 text-muted cursor-not-allowed'
          }`}
        >
          {phase.status === 'loading' ? 'Auditing transcript… (~60-120s)' : 'Audit transcript'}
        </button>
      </div>

      {/* Status */}
      {phase.status === 'loading' && (
        <div class="rounded-xl bg-amber-50 border border-amber-200 p-5 text-center space-y-1">
          <p class="text-sm text-amber-800 font-medium">Auditing transcript…</p>
          <p class="text-xs text-amber-700">
            Three stages: identifying argumentative segments → auditing each → finding cross-segment patterns.
          </p>
        </div>
      )}

      {phase.status === 'error' && (
        <div class="rounded-xl bg-red-50 border border-red-200 p-4">
          <p class="text-sm text-red-700">{phase.message}</p>
        </div>
      )}

      {phase.status === 'done' && (
        <TranscriptResults result={phase.result} />
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Results display
// ---------------------------------------------------------------------------

const CROSS_FINDING_LABELS: Record<string, string> = {
  walked_back_claim:          'Walked-back claim',
  doubled_down_claim:          'Doubled-down claim',
  repeated_unstated_warrant:  'Repeated unstated warrant',
  shifted_framing:             'Shifted framing',
  unresolved_counterargument: 'Unresolved counterargument',
  consistent_strength:         'Consistent strength',
  other:                       'Other',
};

const SEVERITY_STYLES: Record<string, string> = {
  high:   'border-red-200 bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low:    'border-hairline bg-paper',
};

function fmtTime(sec: number): string {
  if (sec === 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function CrossSegmentSection({ findings, summary }: { findings: CrossSegmentFinding[]; summary: string }) {
  return (
    <div class="rounded-xl border border-violet-200 bg-surface p-5 sm:p-6 space-y-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-violet-600 mb-2">Cross-segment synthesis</p>
        <p class="text-sm text-ink leading-relaxed italic">"{summary}"</p>
      </div>
      {findings.length > 0 && (
        <div class="space-y-2">
          {findings.map((f, i) => (
            <div key={i} class={`rounded-lg border p-3 ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.low}`}>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-semibold text-ink-strong">{CROSS_FINDING_LABELS[f.kind] ?? f.kind}</span>
                <span class={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                  f.severity === 'high'   ? 'bg-red-100 text-red-700' :
                  f.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                                            'bg-hairline/40 text-ink'
                }`}>{f.severity}</span>
                <span class="text-xs text-muted ml-auto">spans {f.segmentIds.join(', ')} · {confBand(f.confidence)}</span>
              </div>
              <p class="text-xs text-ink leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SegmentCard({ segment, audit }: { segment: ArgumentSegment; audit: SegmentAudit | undefined }) {
  const [open, setOpen] = useState(false);
  const timeRange = segment.startSec > 0 ? `${fmtTime(segment.startSec)} - ${fmtTime(segment.endSec)}` : '';

  return (
    <div class="rounded-xl border border-hairline bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        class="w-full text-left px-5 py-4 hover:bg-paper transition-colors flex items-start gap-3"
      >
        <span class="font-mono text-xs font-semibold text-muted shrink-0 mt-0.5">{segment.id}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            {timeRange && <span class="text-xs text-muted font-mono tabular-nums">{timeRange}</span>}
            <span class="text-xs text-muted">{confBand(segment.confidence)}</span>
          </div>
          <p class="text-sm font-medium text-ink-strong leading-snug">{segment.claimSummary}</p>
        </div>
        <svg
          class={`w-4 h-4 text-muted transition-transform shrink-0 mt-1 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        ><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </button>

      {open && audit && (
        <div class="border-t border-hairline px-5 py-4 space-y-4 bg-paper">
          <ArgumentExtraction result={audit.extraction} />
          <hr class="border-hairline" />
          <AuditResults result={audit.audit} />
        </div>
      )}
      {open && !audit && (
        <div class="border-t border-hairline px-5 py-4 text-xs text-muted italic bg-paper">
          Audit unavailable for this segment.
        </div>
      )}
    </div>
  );
}

function TranscriptResults({ result }: { result: TranscriptAuditResult }) {
  const argSegments = result.segmentation.segments.filter(s => s.kind === 'argument');

  return (
    <div class="space-y-4">
      {/* Cross-segment synthesis at top */}
      {result.synthesis && (
        <CrossSegmentSection
          findings={result.synthesis.findings}
          summary={result.synthesis.overallSummary}
        />
      )}

      {/* Stats */}
      <div class="rounded-lg border border-hairline bg-surface px-4 py-3 flex flex-wrap items-center gap-4 text-xs">
        <span class="text-muted">
          <strong class="text-ink-strong">{result.segmentation.argumentCount}</strong> argumentative segments
        </span>
        <span class="text-muted">·</span>
        <span class="text-muted">
          <strong class="text-ink-strong">{result.segmentation.excludedCount}</strong> excluded (intros, ads, tangents)
        </span>
        {result.synthesis && (
          <>
            <span class="text-muted">·</span>
            <span class="text-muted">
              <strong class="text-ink-strong">{result.synthesis.findings.length}</strong> cross-segment findings
            </span>
          </>
        )}
      </div>

      {/* Segment list */}
      <div class="space-y-2">
        {argSegments.map(seg => {
          const audit = result.segmentAudits.find(sa => sa.segmentId === seg.id);
          return <SegmentCard key={seg.id} segment={seg} audit={audit} />;
        })}
      </div>

      {result.segmentation.notes && (
        <p class="text-xs text-muted italic px-2">{result.segmentation.notes}</p>
      )}
    </div>
  );
}
