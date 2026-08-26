import { useState, useEffect, useRef } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import AuditResults from '../audit/AuditResults';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import ToulminCallouts from '../audit/ToulminCallouts';
import HighlightedDraft from '../studio/HighlightedDraft';
import { SAMPLES } from '../../data/samples';
import { railProgress, railShift } from '../../lib/rail-scroll';

// ---------------------------------------------------------------------------
// Three geometries for the Reader's result, on the real helmets sample.
//
// The problem, measured on /audit at 1440px: the text column stops at 632px
// and the findings column runs to 2763px, so about 2,100px of blank page runs
// down the left while you read findings. The text panel has its own inner
// scroll but does not stick, so the moment you scroll past it the text is
// gone, which defeats the point of anchoring findings to quotes.
//
// Nothing here ships. Pick one and it gets built into AuditForm.
// ---------------------------------------------------------------------------

export type Variant = 'text-pinned' | 'findings-pinned' | 'three-column' | 'three-column-tracking';

const SAMPLE = SAMPLES[0]!; // helmets op-ed
const AUDIT      = SAMPLE.cached.audit      as AuditResult;
const EXTRACTION = SAMPLE.cached.extraction as ArgumentExtractionResult;

// The rail geometry both pinned variants share. 4.5rem clears the site header;
// 6rem is that plus breathing room at the foot.
const PINNED = 'xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overflow-x-hidden';

/**
 * D's rail behaviour: the page scroll advances the rails.
 *
 * C pins each rail and gives it its own scrollbar, so the page scroll does
 * nothing to it and you have to put the pointer inside a rail to move it.
 * Daniel's note: "when scrolling down the page findings and structure can go
 * up". That is the sticky-sidebar pattern, and there is no CSS for it. The
 * CSSWG issue asking sticky to scroll when taller than the viewport (#7092)
 * was closed without a solution, and the CSS-only answer everyone reaches for
 * (max-height plus overflow-y) IS what C already does.
 *
 * So: each rail is a fixed-height window and the page scroll drives its
 * content, each at its own rate, so a short rail and a long rail both finish
 * together at the foot of the page. One gesture moves everything; the centre
 * text holds still with its own scrollbar for when you want to read it.
 */
function useScrollDriven(enabled: boolean) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const frame = frameRef.current;
    if (!frame) return;

    let raf = 0;
    const apply = () => {
      raf = 0;
      const box = frame.getBoundingClientRect();
      // The arithmetic lives in src/lib/rail-scroll.ts and is unit-tested; the
      // DOM half here is not, because the browser pane this was written in
      // does not scroll. Both rails divide their own overflow by the SAME
      // progress value, so a short rail and a long one finish together.
      const t = railProgress(box.top, frame.offsetHeight, window.innerHeight);
      for (const el of Array.from(frame.querySelectorAll<HTMLElement>('[data-track]'))) {
        const inner = el.firstElementChild as HTMLElement | null;
        if (!inner) continue;
        inner.style.transform = `translateY(-${railShift(t, inner.offsetHeight, el.clientHeight)}px)`;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
      for (const el of Array.from(frame.querySelectorAll<HTMLElement>('[data-track]'))) {
        const inner = el.firstElementChild as HTMLElement | null;
        if (inner) inner.style.transform = '';
      }
    };
  }, [enabled]);

  return frameRef;
}

function Panel({ label, children, sub }: { label: string; sub?: string; children: preact.ComponentChildren }) {
  return (
    <section class="rounded-lg border border-hairline bg-surface">
      <header class="flex items-center gap-2 px-4 py-3 border-b border-hairline">
        <span class="font-mono text-[13px] uppercase tracking-[0.08em] text-muted">{label}</span>
        {sub && <span class="ml-auto font-mono text-[13px] text-muted">{sub}</span>}
      </header>
      <div class="px-4 py-4">{children}</div>
    </section>
  );
}

function Findings({ activeKey, onNavigate }: { activeKey: string | null; onNavigate: (k: string) => void }) {
  return <AuditResults result={AUDIT} scope="span" flush activeFindingKey={activeKey} onFindingNavigate={onNavigate} />;
}

function Structure() {
  return (
    <div class="space-y-4">
      <ArgumentExtraction result={EXTRACTION} />
      <ToulminCallouts toulmin={AUDIT.toulmin} />
    </div>
  );
}

export default function ReaderColumns() {
  const [variant, setVariant] = useState<Variant>('text-pinned');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [flashKey, setFlashKey]   = useState<string | null>(null);

  const draft = (
    <HighlightedDraft
      text={SAMPLE.text}
      audit={AUDIT}
      activeFindingKey={activeKey}
      flashKey={flashKey}
      onHighlightClick={(k) => setActiveKey(k)}
    />
  );

  const goToSpan = (k: string) => {
    setActiveKey(k);
    setFlashKey(k);
    window.setTimeout(() => setFlashKey(null), 1200);
  };

  const options: { id: Variant; label: string }[] = [
    { id: 'text-pinned',           label: 'A · Text pinned' },
    { id: 'findings-pinned',       label: 'B · Findings pinned' },
    { id: 'three-column',          label: 'C · Three columns' },
    { id: 'three-column-tracking', label: 'D · Three columns, rails track the page' },
  ];

  const trackFrame = useScrollDriven(variant === 'three-column-tracking');
  const issues = AUDIT.namedFallacies.length + AUDIT.loadedLanguage.length;

  return (
    <div class="space-y-6">
      <nav class="flex flex-wrap items-stretch gap-1 rounded-lg border border-hairline bg-paper p-1 w-fit" aria-label="Layout">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setVariant(o.id)}
            aria-pressed={variant === o.id}
            class={`min-h-11 rounded-md px-4 text-[15px] transition-colors ${
              variant === o.id ? 'bg-surface text-ink-strong font-semibold shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </nav>

      {variant === 'text-pinned' && (
        <div class="flex flex-col xl:flex-row gap-4 items-start">
          <div class={`w-full xl:w-[55%] min-w-0 space-y-4 ${PINNED}`}>
            <Panel label="Your text">{draft}</Panel>
          </div>
          <div class="w-full xl:w-[45%] min-w-0 space-y-4">
            <Panel label="Findings" sub={`${AUDIT.namedFallacies.length + AUDIT.loadedLanguage.length} issues`}>
              <Findings activeKey={activeKey} onNavigate={goToSpan} />
            </Panel>
            <Panel label="Argument structure"><Structure /></Panel>
          </div>
        </div>
      )}

      {variant === 'findings-pinned' && (
        <div class="flex flex-col xl:flex-row gap-4 items-start">
          <div class="w-full xl:w-[55%] min-w-0 space-y-4">
            <Panel label="Your text">{draft}</Panel>
            <Panel label="Argument structure"><Structure /></Panel>
          </div>
          <div class={`w-full xl:w-[45%] min-w-0 space-y-4 ${PINNED}`}>
            <Panel label="Findings" sub={`${AUDIT.namedFallacies.length + AUDIT.loadedLanguage.length} issues`}>
              <Findings activeKey={activeKey} onNavigate={goToSpan} />
            </Panel>
          </div>
        </div>
      )}

      {variant === 'three-column' && (
        <div class="flex flex-col xl:flex-row gap-4 items-start" style={{ minHeight: 'calc(100vh - 6rem)' }}>
          <div class={`w-full xl:w-[28%] min-w-0 space-y-4 xl:order-1 ${PINNED}`}>
            <Panel label="Argument structure"><Structure /></Panel>
          </div>
          <div class="w-full xl:w-[44%] min-w-0 space-y-4 xl:order-2">
            <Panel label="Your text">{draft}</Panel>
          </div>
          <div class={`w-full xl:w-[28%] min-w-0 space-y-4 xl:order-3 ${PINNED}`}>
            <Panel label="Findings" sub={`${issues} issues`}>
              <Findings activeKey={activeKey} onNavigate={goToSpan} />
            </Panel>
          </div>
        </div>
      )}

      {/* D. The frame is deliberately taller than the viewport: that extra
         height IS the scroll budget the rails travel through. Below xl it
         collapses to the ordinary stack and the effect does nothing. */}
      {variant === 'three-column-tracking' && (
        <div ref={trackFrame} class="xl:h-[220vh]">
          <div class="flex flex-col xl:flex-row gap-4 items-start xl:sticky xl:top-[4.5rem]">
            <div class="w-full xl:w-[28%] min-w-0 xl:order-1">
              <div class="rounded-lg border border-hairline bg-surface">
                <header class="flex items-center gap-2 px-4 py-3 border-b border-hairline">
                  <span class="font-mono text-[13px] uppercase tracking-[0.08em] text-muted">Argument structure</span>
                </header>
                <div data-track class="px-4 py-4 xl:h-[calc(100vh-10rem)] overflow-hidden">
                  <div class="transition-transform duration-100 ease-out"><Structure /></div>
                </div>
              </div>
            </div>

            <div class="w-full xl:w-[44%] min-w-0 xl:order-2">
              <Panel label="Your text">{draft}</Panel>
            </div>

            <div class="w-full xl:w-[28%] min-w-0 xl:order-3">
              <div class="rounded-lg border border-hairline bg-surface">
                <header class="flex items-center gap-2 px-4 py-3 border-b border-hairline">
                  <span class="font-mono text-[13px] uppercase tracking-[0.08em] text-muted">Findings</span>
                  <span class="ml-auto font-mono text-[13px] text-muted">{issues} issues</span>
                </header>
                <div data-track class="px-4 py-4 xl:h-[calc(100vh-10rem)] overflow-hidden">
                  <div class="transition-transform duration-100 ease-out">
                    <Findings activeKey={activeKey} onNavigate={goToSpan} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
