import { useState, useEffect, useRef } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import { totalFindingCount, auditVerdict, lensesChecked } from '../../lib/audit';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import AuditResults from './AuditResults';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import ToulminCallouts from './ToulminCallouts';
import HighlightedDraft from '../studio/HighlightedDraft';
import MobileFindingsSheet from '../studio/MobileFindingsSheet';
import ReaderOpposingCase from '../counterargument/ReaderOpposingCase';
import { applyContextualSeverity } from '../../../functions/_lib/audit/contextual-severity';
import { track } from '../../lib/analytics/track';
import { SAMPLES, type Sample } from '../../data/samples';
import SpecimenRail from './SpecimenRail';
import { MIN_CHARS, MAX_CHARS, READER_AUDIT_ERROR_MESSAGES as ERROR_MESSAGES } from '../tool/constants';
import AuditLoading from '../tool/AuditLoading';
import SampleLoading from '../tool/SampleLoading';
import ShareAuditButton from './ShareAuditButton';
import GroundednessDefs from './GroundednessDefs';
import TranscriptSegments from '../transcript/TranscriptSegments';
import type { PickableSegment } from '../../../functions/_lib/transcript/segment-handler';
import { hasSeenGroundednessDefs, markGroundednessDefsSeen, findingsSheetButtonLabel } from './reader-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditApiResponse =
  | { ok: true;  audit: AuditResult; sourceText?: string; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

type SegmentApiResponse =
  | { ok: true;  title: string | null; sourceUrl: string | null; segments: PickableSegment[]; excluded: { count: number; total: number } }
  | { ok: false; error: { code: string; message: string } };

type ExtractionApiResponse =
  | { ok: true;  extraction: ArgumentExtractionResult; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// MIN_CHARS / MAX_CHARS now come from ../tool/constants (shared with
// Studio). First-time-visitor examples come from the shared Studio sample set
// (src/data/samples) — pre-cached audits, loaded instantly with no API call.

// ERROR_MESSAGES comes from ../tool/constants (READER_AUDIT_ERROR_MESSAGES),
// shared with the workbench.

// A YouTube link is not an article, so sending it to the article extractor
// produces a failure the reader cannot act on. It goes to segmentation instead
// (owner call 2026-08-25, replacing the Transcript room). Matches watch pages,
// youtu.be short links, embeds and shorts.
const YOUTUBE_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?|embed\/|shorts\/|live\/)|youtu\.be\/)/i;

export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_RE.test(url.trim());
}

// Count span-level findings for the results verdict bar. The Reader has no
// dismissed state (no document), so the raw arrays are the active set.
function countFindings(r: AuditResult) {
  const groups: { severity: string }[][] = [
    r.namedFallacies as { severity: string }[],
    r.loadedLanguage as { severity: string }[],
    (r.keyTermScrutiny ?? []) as { severity: string }[],
    (r.referentChecks ?? []) as { severity: string }[],
    (r.falsifiabilityChecks ?? []) as { severity: string }[],
    (r.modalScopeChecks ?? []) as { severity: string }[],
  ];
  let total = 0, critical = 0;
  for (const g of groups) for (const f of g) { total++; if (f.severity === 'high') critical++; }
  return { total, critical };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AuditForm({ initialText = '', initialUrl = '', initialSampleId = '' }: { initialText?: string; initialUrl?: string; initialSampleId?: string }) {
  /**
   * Adopt whatever is already in the field, read at FIRST RENDER.
   *
   * The textarea below is controlled and this state starts empty, so a visitor
   * who pastes a link before the JavaScript arrives has it WIPED the moment it
   * does: Preact reconciles the field back to the empty string it believes in.
   * On a fast connection the window is a couple of hundred milliseconds and
   * nobody notices. On a slow one it eats the paste and the reader has no idea
   * why. Same defect that was found in QuestionBriefing on 2026-08-18, and the
   * Reader's field has always had it too.
   *
   * It has to be read in the useState initialiser, not in an effect. Measured
   * here: an effect reads '' because Preact has already cleared the field by
   * the time effects run. The initialiser runs during the first render, while
   * the server-rendered DOM is still untouched, which is the only moment the
   * pasted value still exists.
   */
  const [input, setInput]         = useState(() => {
    if (typeof document === 'undefined') return '';
    return (document.querySelector('textarea[data-audit-field]') as HTMLTextAreaElement | null)?.value ?? '';
  });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [result, setResult]       = useState<AuditResult | null>(null);
  const [extraction, setExtraction] = useState<ArgumentExtractionResult | null>(null);
  const [loadedFromLink, setLoadedFromLink] = useState(false);
  // The text the audit ran against — drives the deeper-lens panel and the
  // highlighted draft. For text audits it's the pasted text; for URL audits it's
  // the server-extracted article body.
  const [sourceText, setSourceText] = useState<string>('');
  // Which mode the *last completed* audit ran in — decides whether the left
  // highlighted-draft panel appears. Not derived from `input`, which can change
  // after results render.
  const [auditedMode, setAuditedMode] = useState<'text' | 'url' | null>(null);
  // After a successful audit the input collapses to a summary bar; "Edit" flips
  // this back to the full field.
  const [editing, setEditing] = useState(false);
  // Tap-a-highlight → its finding card (was a no-op in the Reader, leaving the
  // severity marks inert on touch, where hover doesn't exist). Mirrors Studio's
  // wiring: the key drives the card's active ring via data-finding-key.
  const [activeFindingKey, setActiveFindingKey] = useState<string | null>(null);
  // Below xl the findings live in the bottom sheet (Stage 1 of the shell
  // backport): the Reader controls the sheet so a highlight tap can open it.
  const [sheetOpen, setSheetOpen] = useState(false);
  // Transient flash on a draft span when the user jumps to it from a finding
  // card - the reverse direction of goToFinding (Studio's two-way wiring).
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  // The current result came from a pre-cached sample rather than a live engine
  // run - drives the honest sample loading state + "Cached demo" annotation.
  const [sampleMode, setSampleMode] = useState(false);
  // Groundedness definition strip: opens automatically with a session's first
  // result until dismissed once (localStorage), reopenable from the (?)
  // affordance on the verdict bar.
  const [defsOpen, setDefsOpen] = useState(false);
  // Transcript map: the segment list stands between the input and a result.
  // Null means no transcript is in play, which is the ordinary case.
  const [segments, setSegments] = useState<PickableSegment[] | null>(null);
  const [segmentMeta, setSegmentMeta] = useState<{ title: string | null; excluded: { count: number; total: number } }>({ title: null, excluded: { count: 0, total: 0 } });
  const [segmenting, setSegmenting] = useState(false);
  const formRef  = useRef<HTMLDivElement>(null);

  // Examples are the highest-leverage first-run comprehension aid, so show them
  // by default for a cold arrival (no deep-link prefill). They auto-collapse
  // once the visitor commits real text (see the onInput handler).
  const [showExamples, setShowExamples] = useState(!initialText && !initialUrl && !initialSampleId);

  // /?audit=<slug> or /?url=<src> deep-link from a briefing: pre-load the field
  // and bring it into view. We deliberately don't auto-run — the reader presses
  // the button — so a crawler or accidental prefetch can't burn audit quota.
  useEffect(() => {
    // A paste that beat hydration beats a prefill: the person typing is more
    // recent than the URL that brought them here. This closure holds the
    // FIRST-RENDER value of `input`, which is exactly what was adopted.
    if (input) return;
    // Home-feed launcher example chip → /audit?sample=<id>: load the pre-cached
    // sample immediately (worked result, no API call). Takes precedence over the
    // text/URL prefills, which are mutually exclusive with it in practice.
    if (initialSampleId) {
      const s = SAMPLES.find((x) => x.id === initialSampleId);
      if (s) { loadSample(s); return; }
    }
    if (initialUrl && initialUrl.startsWith('http')) {
      setInput(initialUrl);
      setLoadedFromLink(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (initialText && initialText.length >= MIN_CHARS) {
      setInput(initialText);
      setLoadedFromLink(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Homepage compact launcher hand-off (D1-B): the launcher stashes the
      // pasted value and navigates here; consume it once.
      try {
        const h = sessionStorage.getItem('wst_handoff');
        if (h) {
          sessionStorage.removeItem('wst_handoff');
          setInput(h);
        }
      } catch { /* storage unavailable */ }
    }
  }, []);

  // First-time visitors get the label glossary alongside their first result
  // (the strip itself only renders once a result exists). Post-hydration so
  // the server render never touches localStorage.
  useEffect(() => {
    if (!hasSeenGroundednessDefs()) setDefsOpen(true);
  }, []);

  function dismissDefs() {
    setDefsOpen(false);
    markGroundednessDefsSeen();
  }

  const trimmed   = input.trim();
  // A URL is auditable even when wrapped in a short label (see runAudit): a
  // pasted link with a trailing space or "Check this: <url>" should enable the
  // button, not sit blocked under the 50-char text minimum.
  const urlHit    = trimmed.match(/https?:\/\/\S+/);
  const looksUrl  = !!urlHit && trimmed.replace(urlHit[0], '').trim().length <= 20;
  const charCount = input.length;
  const textValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const canSubmit = !loading && (looksUrl || textValid);
  // The left panel is the highlighted draft (text audits only). The skeleton +
  // Toulmin now live together in the right-column "Argument structure" region,
  // so a URL audit (no draft) collapses findings + structure to full width.
  const hasLeftContent = auditedMode === 'text' && !!sourceText;
  // A4 experimental flag (off by default) — `?ctxsev=1` re-bands severities by
  // argument context for A/B evaluation. Never on in production.
  const ctxSev = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ctxsev') === '1';
  // The result actually shown (ctxsev re-bands severities when the flag is on).
  const displayResult = result ? (ctxSev && extraction ? applyContextualSeverity(result, extraction) : result) : null;
  const counts = result ? countFindings(result) : { total: 0, critical: 0 };
  const auditedWords = sourceText ? sourceText.trim().split(/\s+/).filter(Boolean).length : 0;

  // Jump-tab teleport within the single results scroll. Opens the target fold
  // (or the fold that contains the target) before scrolling to it.
  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const det = el.closest('details') as HTMLDetailsElement | null;
    if (det) det.open = true;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  // Highlight tap → the finding. Desktop (xl+): open the findings fold and
  // scroll to the card. Below xl: open the bottom sheet (the sheet scrolls to
  // the card itself via scrollToKey).
  function goToFinding(key: string) {
    setActiveFindingKey(key);
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) {
      const det = document.getElementById('r-findings') as HTMLDetailsElement | null;
      if (det) det.open = true;
      requestAnimationFrame(() => {
        document.querySelector(`[data-finding-key="${CSS.escape(key)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      setSheetOpen(true);
    }
  }

  // Finding card tap → its quote in the draft (the reverse of goToFinding;
  // Studio's handleNavigateToSpan pattern). Desktop: open the "Your text" fold
  // and scroll the span into view with a brief flash. Below xl: dismiss the
  // sheet first (it scroll-locks the body), then reveal.
  function goToSpan(key: string) {
    setActiveFindingKey(key);
    const revealAndFlash = () => {
      setFlashKey(key);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashKey(null), 1100);
      const det = document.getElementById('r-text') as HTMLDetailsElement | null;
      if (det) det.open = true;
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-match-key="${CSS.escape(key)}"]`);
        // behavior:'auto' (instant): smooth scrollIntoView is silently dropped
        // in some environments (same constraint Studio hit with this wiring).
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
      });
    };
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1280px)').matches) {
      setSheetOpen(false);
      window.setTimeout(revealAndFlash, 320);
      return;
    }
    revealAndFlash();
  }

  // Reset to the pre-audit state (from the collapsed input bar's "New audit").
  function newAudit() {
    setInput('');
    setResult(null);
    setExtraction(null);
    setError(null);
    setAuditedMode(null);
    setSourceText('');
    setEditing(false);
    setSampleMode(false);
    setSegments(null);
    setSegmenting(false);
  }

  // Map a transcript into its argumentative passages. One Flash call: the
  // reader then spends one ordinary audit on the passage they pick, instead of
  // the twelve audits plus a Pro synthesis the old Transcript room ran.
  async function runSegmentation(body: { kind: 'youtube'; url: string } | { kind: 'text'; text: string }) {
    setSegmenting(true);
    setError(null);
    setResult(null);
    setExtraction(null);
    setSegments(null);
    setSampleMode(false);
    track('transcript_segment_started', { surface: 'reader', kind: body.kind });

    try {
      const res  = await fetch('/api/transcript-segments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as SegmentApiResponse;

      if (!data.ok) {
        // The server writes these: a captionless video and a spent quota need
        // different responses from the reader, so pass its wording through
        // rather than flattening both to "something went wrong".
        setError(data.error.message);
        return;
      }

      setSegments(data.segments);
      setSegmentMeta({ title: data.title, excluded: data.excluded });
      track('transcript_segment_done', { surface: 'reader', segments: data.segments.length });
    } catch {
      setError('Could not read that transcript. Check the connection and try again.');
    } finally {
      setSegmenting(false);
    }
  }

  // Core audit runner, shared by the form submit and the example chips.
  async function runAudit(raw: string) {
    const t      = raw.trim();
    // Detect a URL even when it isn't the whole input: a trailing space from an
    // autocomplete drop, or a short wrapper ("Check this: https://…", an Android
    // share sheet's "Look at this — https://…") used to fall through to text
    // mode and error as "too short". Treat it as a URL audit only when the
    // non-URL remainder is negligible (just a label), so a real argument that
    // merely quotes a link still audits as text.
    const urlMatch  = t.match(/https?:\/\/\S+/);
    const remainder = urlMatch ? t.replace(urlMatch[0], '').trim() : t;
    const isUrl     = !!urlMatch && remainder.length <= 20;
    const url       = isUrl ? urlMatch![0] : '';
    const isText    = !isUrl;
    // A video is not an article. Sending a YouTube link to the article
    // extractor returns a player shell, which the engine then dutifully audits
    // as if it were prose.
    if (isUrl && isYouTubeUrl(url)) { void runSegmentation({ kind: 'youtube', url }); return; }
    // Guard: text needs to clear the length bounds; URLs always pass.
    if (isText && !(raw.length >= MIN_CHARS && raw.length <= MAX_CHARS)) return;

    setLoading(true);
    setEditing(false);
    setError(null);
    setResult(null);
    setExtraction(null);
    setSampleMode(false);

    const body      = isText ? { text: raw } : { url };
    const startedAt = performance.now();
    track('audit_started', { surface: 'reader', source_kind: isText ? 'text' : 'url' });

    try {
      const requests: Promise<unknown>[] = [
        fetch('/api/audit', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        }).then(r => r.json() as Promise<AuditApiResponse>),
      ];

      if (isText) {
        requests.push(
          fetch('/api/extract-argument', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ text: raw }),
          }).then(r => r.json() as Promise<ExtractionApiResponse>),
        );
      }

      const [auditData, extractionData] = await Promise.allSettled(requests);

      // Handle audit result
      if (auditData.status === 'fulfilled') {
        const data = auditData.value as AuditApiResponse;
        if (data.ok) {
          setResult(data.audit);
          setSourceText(data.sourceText ?? (isText ? raw : ''));
          setAuditedMode(isText ? 'text' : 'url');
          track('audit_completed', {
            latency_ms:    Math.round(performance.now() - startedAt),
            finding_count: totalFindingCount(data.audit),
            has_phase_two: false,
          });
        } else {
          const code = data.error.code;
          setError(ERROR_MESSAGES[code] ?? data.error.message ?? 'Something went wrong.');
          track('audit_failed', { error_code: code });
        }
      } else {
        setError('Network error - check your connection and try again.');
        track('audit_failed', { error_code: 'NETWORK' });
      }

      // Handle extraction result (best-effort — don't block audit display on failure)
      if (extractionData && extractionData.status === 'fulfilled') {
        const data = extractionData.value as ExtractionApiResponse;
        if (data.ok) setExtraction(data.extraction);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    runAudit(input);
  }

  // A picked segment is just text. Its verbatim words go through the ordinary
  // audit, so what gets audited is what was actually said, not a summary of it.
  function auditSegment(segment: PickableSegment) {
    setInput(segment.text);
    setSegments(null);
    track('transcript_segment_picked', { surface: 'reader', words: segment.words });
    void runAudit(segment.text);
  }

  // Example picker: load a PRE-CACHED sample (no API call). Honest UX: a
  // distinct "pre-computed sample" loading state with no fake engine-time
  // theatre, and the delivered result is annotated as a cached demo in the
  // verdict bar so nobody mistakes it for a live run.
  function loadSample(sample: Sample) {
    setShowExamples(false);
    setError(null);
    setEditing(false);
    setResult(null);
    setExtraction(null);
    setInput(sample.text);
    setSourceText(sample.text);
    setAuditedMode('text');
    setSampleMode(true);
    setLoading(true);
    track('sample_picked', { sample_id: sample.id });
    // Short beat so the swap doesn't jump-cut. NOT simulated engine time.
    window.setTimeout(() => {
      setResult(sample.cached.audit as AuditResult);
      setExtraction(sample.cached.extraction as ArgumentExtractionResult);
      setLoading(false);
    }, 400);
  }

  return (
    <div class="space-y-5" ref={formRef}>

      {loadedFromLink && (
        <div class="rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
          <p class="text-xs text-accent">
            Loaded from a briefing. Press the <span class="font-semibold">audit</span> button to run the full structural audit on it.
          </p>
        </div>
      )}

      {/* Empty state: the tool and a specimen rail sit side by side on xl —
         before the first result the right half of the page was dead space.
         The grid collapses back to the plain stack the moment a result or
         spinner exists (the rail is proof-of-what-you-get, not chrome to
         compete with real findings). */}
      <div class={(!result && !loading) ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10 xl:items-start' : ''}>
      <div>
      {/* Input: full field before an audit (or when editing), a compact summary
          bar after — so the pasted text isn't duplicated with the marked draft. */}
      {(result && !editing) ? (
        <div class="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-2.5">
          <span class="text-sm text-ink">Audited <span class="font-medium">{auditedWords.toLocaleString()} words</span></span>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} class="text-xs px-3 py-1 rounded-md border border-hairline text-ink hover:border-accent hover:text-accent transition-colors">Edit</button>
            <button type="button" onClick={newAudit} class="text-xs px-3 py-1 rounded-md bg-accent-support text-paper hover:bg-accent-support/90 transition-colors">New audit</button>
          </div>
        </div>
      ) : (
      <form onSubmit={handleSubmit} class="space-y-3">
        {/* Unified input — auto-detects a pasted URL vs argument text. The run
            control is an inline arrow inside the field (no separate CTA, no tabs). */}
        <div class="relative">
          <textarea
            data-audit-field
            value={input}
            onInput={e => {
              const v = (e.target as HTMLTextAreaElement).value;
              setInput(v);
              if (v.length >= MIN_CHARS && showExamples) setShowExamples(false);
            }}
            placeholder="Paste an argument, or drop a link to audit…"
            aria-label="Argument text or URL to audit"
            rows={loadedFromLink ? 6 : 2}
            class="w-full rounded-xl border border-hairline bg-surface pl-4 pr-24 py-3 text-base sm:text-sm text-ink placeholder-muted leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
            style={`min-height:${loadedFromLink ? 180 : 64}px;`}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Audit this argument"
            title="Audit this argument"
            class={`absolute right-2.5 bottom-2.5 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-lg text-sm font-semibold transition-colors ${
              canSubmit ? 'bg-accent-support text-paper hover:bg-accent-support/90' : 'bg-hairline/50 text-muted cursor-not-allowed'
            }`}
          >
            {loading ? (
              <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <>
                Audit
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Contextual hint: character budget for text, fetch caveat for a URL. */}
        {looksUrl && isYouTubeUrl(urlHit![0]) ? (
          <p class="text-xs text-muted">
            The captions are read and mapped into the passages where someone argues for something.
            Nothing is audited until you pick one. Videos with captions turned off cannot be read.
          </p>
        ) : looksUrl ? (
          <p class="text-xs text-muted">
            The page must be publicly accessible. Paywalled articles can't be extracted. Paste the text directly instead.
          </p>
        ) : (
          <div class="flex justify-between text-xs">
            <span class={charCount > 0 && charCount < MIN_CHARS ? 'text-sev-med' : charCount > MAX_CHARS ? 'text-accent' : 'text-muted'}>
              {charCount > 0 && charCount < MIN_CHARS
                ? `${MIN_CHARS - charCount} more character${MIN_CHARS - charCount === 1 ? '' : 's'} needed`
                : charCount > MAX_CHARS
                ? 'Too long for one audit'
                : ''}
            </span>
            <span class={charCount > MAX_CHARS ? 'text-accent' : 'text-muted'}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          </div>
        )}

        {/* Over the audit ceiling is where a transcript lands, so offer the
            thing that handles length instead of only refusing. One Flash call
            maps it; the reader then audits one passage. */}
        {charCount > MAX_CHARS && !segmenting && (
          <div class="rounded-lg border border-hairline bg-paper px-4 py-3">
            <p class="text-[15px] text-ink leading-relaxed mb-2">
              That is {charCount.toLocaleString()} characters, past the {MAX_CHARS.toLocaleString()} an audit reads
              in one pass. If it is a transcript or a talk, map it into the passages where someone is
              arguing for something, then audit the one you want.
            </p>
            <button
              type="button"
              onClick={() => runSegmentation({ kind: 'text', text: input })}
              class="inline-flex items-center min-h-11 rounded-lg border border-accent-support/40 px-4 text-[15px] font-semibold text-accent-support hover:bg-accent-support/5 transition-colors"
            >
              Map it into passages
            </button>
          </div>
        )}

        {/* Pre-cached example picker — tucked behind a "Try an example" toggle so
            it doesn't dominate the page (Daniel: examples off the main page). Picks
            load instantly (no API) with the short delay + loading animation so it
            still feels real. Cards stay horizontal (his pref) but carry the Studio
            sample set's failure-mode tags. */}
        {!result && !loading && (
          <div>
            <button
              type="button"
              onClick={() => setShowExamples(v => !v)}
              class="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors py-2 -my-1"
            >
              New here? Try an example
              <svg class={`w-3 h-3 transition-transform ${showExamples ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            {showExamples && (
              <div class="mt-2 rounded-lg border border-hairline bg-paper p-2">
                <p class="px-1 pb-1.5 text-[0.625rem] uppercase tracking-wider text-muted">Worked examples · load instantly</p>
                <div class="grid sm:grid-cols-3 gap-2">
                  {SAMPLES.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => loadSample(s)}
                      class="group text-left rounded-md border border-hairline bg-surface p-2.5 hover:border-accent/40 transition-colors"
                    >
                      <div class="flex items-baseline justify-between gap-1.5">
                        <span class="text-[0.75rem] font-semibold text-ink-strong leading-tight">{s.shortLabel}</span>
                        <span class="text-[0.5625rem] uppercase tracking-wider text-muted shrink-0">{s.category}</span>
                      </div>
                      <p class="text-[0.6875rem] text-muted leading-snug mt-0.5 line-clamp-1">{s.title}</p>
                      <div class="flex flex-wrap gap-1 mt-1.5">
                        {s.failureModes.slice(0, 2).map(mode => (
                          <span key={mode} class="text-[0.625rem] font-mono px-1.5 py-0.5 rounded-[2px] border border-hairline bg-paper text-muted font-medium">{mode}</span>
                        ))}
                        {s.failureModes.length > 2 && (
                          <span class="text-[0.625rem] px-1.5 py-0.5 rounded bg-hairline/40 text-muted font-medium">+{s.failureModes.length - 2}</span>
                        )}
                      </div>
                      <span class="inline-block mt-1.5 text-[0.6875rem] font-medium text-accent-support">See the analysis →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </form>
      )}
      </div>
      {!result && !loading && <SpecimenRail onTrySample={() => loadSample(SAMPLES[0])} />}
      </div>

      {loading && (sampleMode ? <SampleLoading /> : <AuditLoading />)}

      {/* Segmentation is one Flash call over the whole transcript, so it is
         slower than a page fetch and faster than an audit. Say what it is
         doing rather than showing the audit spinner, which promises findings. */}
      {segmenting && (
        <div class="rounded-xl border border-hairline bg-surface px-5 py-4">
          <p class="text-[15px] text-ink leading-relaxed">
            Reading the transcript for the passages where someone argues for something. No audit has
            run yet, and nothing is charged against your audits until you pick one.
          </p>
        </div>
      )}

      {segments && !segmenting && !loading && (
        <TranscriptSegments
          segments={segments}
          title={segmentMeta.title}
          excluded={segmentMeta.excluded}
          onPick={auditSegment}
          onReset={newAudit}
        />
      )}

      {error && !loading && (
        <div class="rounded-xl bg-accent/5 border border-accent/30 p-4">
          <p class="text-sm text-accent">{error}</p>
        </div>
      )}

      {/* Verdict-first results (structure 2): a one-line verdict + jump tabs, the
         findings up top (the payoff) with the highlighted draft beside them, and
         the argument structure as a section below the findings in the right
         column. Jump tabs teleport within this single scroll. */}
      {result && !loading && displayResult && (
        <div class="space-y-4">

          {/* One-time glossary for the Logic / Judgment call / Factual chips.
             Sits above the verdict bar; the (?) on the scope strip reopens it. */}
          <GroundednessDefs open={defsOpen} onDismiss={dismissDefs} />

          {/* Verdict bar */}
          <div class="rounded-lg border border-hairline bg-surface px-4 py-3 space-y-2">
            {sampleMode && (
              <span class="inline-flex items-baseline gap-1.5 rounded-[2px] border border-hairline bg-paper px-2 py-1 text-xs text-muted">
                <span class="font-mono text-[11px] uppercase tracking-[0.08em]">Cached demo</span>
                <span>A live audit takes 10 to 20 seconds on your own text.</span>
              </span>
            )}
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium text-ink-strong">
                {counts.total} {counts.total === 1 ? 'issue' : 'issues'} found
              </span>
              {counts.critical > 0 && (
                <span class="inline-flex items-center gap-1 text-xs text-muted">
                  <span class="w-1.5 h-1.5 rounded-full bg-sev-high" aria-hidden="true" />
                  {counts.critical} critical
                </span>
              )}
              {sourceText.trim().length > 0 && (
                <div class="ml-auto">
                  <ShareAuditButton result={displayResult} draftText={sourceText} />
                </div>
              )}
            </div>
            {/* One-line structural verdict — the plain-language read of the
               finding shape (which KIND of objection dominates). */}
            <p class="text-xs text-ink leading-relaxed">{auditVerdict(displayResult)}</p>
            <p class="text-xs text-muted line-clamp-1">
              <span class="font-medium text-ink">Weakest link:</span> {result.toulmin.weakestLink}
            </p>
            {/* Below xl the findings live in the bottom sheet — give the
               verdict bar its own plain door so the floating pill is not the
               only way in. */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              class="xl:hidden inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-hairline text-accent-support hover:bg-accent-support/5 transition-colors"
            >
              {findingsSheetButtonLabel(counts.total)}
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
            {/* Scope strip — what the audit checked (its lenses). Shows base
               checks always, with counts, so a clean result reads as
               "checked, nothing found" rather than "did it run?". */}
            <div class="flex items-center gap-x-3 gap-y-1 flex-wrap pt-2 border-t border-hairline">
              <span class="text-[0.625rem] font-mono uppercase tracking-wider text-muted shrink-0">Checked</span>
              {lensesChecked(displayResult).map(l => (
                <span key={l.key} class="inline-flex items-center gap-1 text-xs text-muted">
                  {l.label}
                  <span class={`font-mono ${l.count > 0 ? 'text-ink font-medium' : 'text-muted/70'}`}>{l.count}</span>
                </span>
              ))}
              {!defsOpen && (
                <button
                  type="button"
                  onClick={() => setDefsOpen(true)}
                  aria-label="What the Logic, Judgment call and Factual labels mean"
                  title="What the finding labels mean"
                  class="ml-auto shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full border border-hairline font-mono text-[11px] text-muted hover:border-accent-support hover:text-accent-support transition-colors"
                >?</button>
              )}
            </div>
          </div>

          {/* Jump tabs — desktop only. Below xl the findings/structure live in
             the bottom sheet (one thumb-tap away at all times), so an in-scroll
             jump row has no job there. */}
          <div class="hidden xl:flex items-center gap-1.5 flex-wrap text-xs">
            <span class="text-muted mr-0.5 shrink-0">Jump to</span>
            <button type="button" onClick={() => jumpTo('r-findings')} class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent hover:text-accent transition-colors">Findings</button>
            {result.loadedLanguage.length > 0 && (
              <button type="button" onClick={() => jumpTo('r-language')} class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent hover:text-accent transition-colors">Language</button>
            )}
            {hasLeftContent && (
              <button type="button" onClick={() => jumpTo('r-text')} class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent hover:text-accent transition-colors">Your text</button>
            )}
            <button type="button" onClick={() => jumpTo('r-structure')} class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent hover:text-accent transition-colors">Structure</button>
            <span class="text-hairline mx-0.5 shrink-0" aria-hidden="true">·</span>
            <a href="/#briefings" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md border border-hairline text-muted hover:border-accent-support hover:text-accent-support transition-colors">Briefings →</a>
          </div>

          {/* Three foldable regions — Your text (left), Findings + Argument
             structure (right). Each is a <details>; the tabs open the target
             fold and scroll to it. */}
          <style>{`
            .rd-fold > summary { list-style: none; }
            .rd-fold > summary::-webkit-details-marker { display: none; }
            .rd-fold .rd-chevron { transition: transform .15s ease; }
            .rd-fold[open] > summary .rd-chevron { transform: rotate(180deg); }
          `}</style>
          {/* Below xl: the highlighted text is the canvas and the findings live
             in the bottom sheet (Studio's mobile shell, backported) — the old
             8-screen linear scroll is gone. Desktop (xl+): the two-column
             folds layout, unchanged. */}
          <div class="flex flex-col xl:flex-row gap-4 items-start">
            {hasLeftContent && (
              <details id="r-text" open class="rd-fold scroll-mt-24 w-full xl:w-[55%] rounded-lg border border-hairline bg-surface">
                <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer">
                  <span class="text-xs font-semibold uppercase tracking-widest text-muted">Your text</span>
                  <svg class="rd-chevron ml-auto w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div class="px-4 pb-4 space-y-4">
                  {auditedMode === 'text' && sourceText && (
                    <HighlightedDraft
                      text={sourceText}
                      audit={displayResult}
                      activeFindingKey={activeFindingKey}
                      flashKey={flashKey}
                      onHighlightClick={goToFinding}
                    />
                  )}
                </div>
              </details>
            )}
            <div class={`hidden xl:block w-full space-y-4 ${hasLeftContent ? 'xl:w-[45%]' : ''}`}>
              <details id="r-findings" open class="rd-fold scroll-mt-24 rounded-lg border border-hairline bg-surface">
                <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer">
                  <span class="text-xs font-semibold uppercase tracking-widest text-muted">Findings</span>
                  <span class="text-xs text-muted ml-auto">{counts.total} {counts.total === 1 ? 'issue' : 'issues'}</span>
                  <svg class="rd-chevron w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div class="px-4 pb-4">
                  {/* Card tap → span only when there is a draft to land in
                     (URL audits without extracted text have no left panel). */}
                  <AuditResults result={displayResult} scope="span" flush activeFindingKey={activeFindingKey} onFindingNavigate={hasLeftContent ? goToSpan : undefined} />
                </div>
              </details>
              <details id="r-structure" open class="rd-fold scroll-mt-24 rounded-lg border border-hairline bg-surface">
                <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer">
                  <span class="text-xs font-semibold uppercase tracking-widest text-muted">Argument structure</span>
                  <span class="text-xs text-muted normal-case tracking-normal hidden sm:inline">skeleton · assumptions · weakest link</span>
                  <svg class="rd-chevron ml-auto w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div class="px-4 pb-4 space-y-4">
                  {extraction && <ArgumentExtraction result={extraction} />}
                  <ToulminCallouts toulmin={displayResult.toulmin} />
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Below xl the findings + structure live here: the floating pill and
         drag-dismissible bottom sheet (Studio's mobile shell, now shared).
         Controlled so a highlight tap in the text opens it at that finding. */}
      {result && !loading && displayResult && (
        <MobileFindingsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          scrollToKey={activeFindingKey}
          totalFindings={counts.total}
          pulse
          tabs={[
            {
              id:    'findings',
              label: 'Findings',
              count: counts.total,
              body:  <AuditResults result={displayResult} scope="span" flush activeFindingKey={activeFindingKey} onFindingNavigate={hasLeftContent ? goToSpan : undefined} />,
            },
            {
              id:    'structure',
              label: 'Structure',
              body:  (
                <div class="space-y-4">
                  {extraction && <ArgumentExtraction result={extraction} />}
                  <ToulminCallouts toulmin={displayResult.toulmin} />
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Strongest opposing case (free, on-demand) — the merged home of the
         retired standalone Steelman tool. */}
      {result && !loading && sourceText && (
        <ReaderOpposingCase text={sourceText} />
      )}

      {/* One next step. This was two: the second pitched the Chrome extension,
         which was never submitted to the Web Store and whose build is now
         frozen, so the card sold a download nobody could install. Create mode
         is the drafting path - the bridge hands the audited text across via the
         same sessionStorage key the homepage launcher uses. Redline is reserved
         for findings, so this uses drafting-blue (accent-support). */}
      {result && !loading && (
        <div>
          <div class="rounded-xl border border-hairline bg-paper p-5 flex flex-col">
            <p class="text-xs font-semibold uppercase tracking-widest text-accent-support mb-2">Work on your own drafts</p>
            {/* Pitch what CLICKING actually gives this user: the free Create
               workspace, with this text carried over. The Pro engine list
               lives behind "See plans" — promising it on the button that lands
               a free user in front of Pro-tagged locks reads as bait. */}
            <p class="text-sm text-ink leading-relaxed mb-3">
              Create is the drafting side of this page: this text carries over, and a free account
              saves drafts and versions, calibrates the audit to your audience, and marks findings
              inline. Pro tools (counterargument, citation audit, evidence check) sit on top.
            </p>
            <div class="flex flex-wrap items-center gap-3 mt-auto">
              <button
                type="button"
                onClick={() => {
                  // Hand the audited text across to Create mode. sessionStorage
                  // is the consume-once contract the homepage launcher uses; the
                  // localStorage copy (15 min TTL) survives the magic-LINK
                  // sign-in flow, which opens in a NEW tab where sessionStorage
                  // is empty — without it the handoff silently dies for exactly
                  // the signed-out users the Create gate sends through email.
                  try {
                    if (sourceText) {
                      sessionStorage.setItem('wst_handoff', sourceText);
                      localStorage.setItem('wst_handoff_ls', JSON.stringify({ t: Date.now(), text: sourceText }));
                    }
                  } catch { /* storage unavailable */ }
                  window.location.assign('/audit?mode=create');
                }}
                class="inline-block rounded-lg bg-accent-support px-5 py-2.5 text-sm font-semibold text-paper hover:bg-accent-support/90 transition-colors"
              >
                Work on this text in Create
              </button>
              <a href="/pricing" class="text-xs text-muted hover:text-ink underline">See plans</a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
