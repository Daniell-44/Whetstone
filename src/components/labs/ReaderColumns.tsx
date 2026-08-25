import { useState } from 'preact/hooks';
import type { AuditResult } from '../../lib/audit';
import type { ArgumentExtractionResult } from '../../lib/extraction';
import AuditResults from '../audit/AuditResults';
import ArgumentExtraction from '../extraction/ArgumentExtraction';
import ToulminCallouts from '../audit/ToulminCallouts';
import HighlightedDraft from '../studio/HighlightedDraft';
import { SAMPLES } from '../../data/samples';

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

export type Variant = 'text-pinned' | 'findings-pinned' | 'three-column';

const SAMPLE = SAMPLES[0]!; // helmets op-ed
const AUDIT      = SAMPLE.cached.audit      as AuditResult;
const EXTRACTION = SAMPLE.cached.extraction as ArgumentExtractionResult;

// The rail geometry both pinned variants share. 4.5rem clears the site header;
// 6rem is that plus breathing room at the foot.
const PINNED = 'xl:sticky xl:top-[4.5rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:overflow-x-hidden';

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
    { id: 'text-pinned',     label: 'A · Text pinned' },
    { id: 'findings-pinned', label: 'B · Findings pinned' },
    { id: 'three-column',    label: 'C · Three columns' },
  ];

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
            <Panel label="Findings" sub={`${AUDIT.namedFallacies.length + AUDIT.loadedLanguage.length} issues`}>
              <Findings activeKey={activeKey} onNavigate={goToSpan} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
