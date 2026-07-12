import { useState, useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

// Pull-up bottom sheet for mobile findings panel.
// Patterns adopted: Linear (sheet + tab strip), Notion (grab handle),
// Apple Maps (swipe-down dismiss), iOS HIG (spring-style ease).

interface Tab {
  id:    string;
  label: string;
  count?: number;
  body:  ComponentChildren;
}

interface Props {
  tabs:           Tab[];
  scoreBadge?:    ComponentChildren;
  totalFindings?: number;
  /** Optional controlled mode (Reader): parent owns open state so a highlight
     tap in the page body can open the sheet. Omitted (Studio) = uncontrolled,
     behaviour unchanged. */
  open?:          boolean;
  onOpenChange?:  (open: boolean) => void;
  /** When set and the sheet opens, scroll the matching [data-finding-key]
     card into view inside the sheet's scroll container. */
  scrollToKey?:   string | null;
  /** Optional controlled active tab — needed when the parent opens the sheet
     to a SPECIFIC tab (only the active tab's body is mounted, so scrollToKey
     can only find cards on the tab that is showing). */
  activeTab?:        string;
  onActiveTabChange?: (id: string) => void;
}

const SWIPE_DISMISS_THRESHOLD_PX = 80;

export default function MobileFindingsSheet({ tabs, scoreBadge, totalFindings, open: controlledOpen, onOpenChange, scrollToKey, activeTab: controlledTab, onActiveTabChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setInternalOpen(v);
  };
  const [mounted, setMounted] = useState(false);
  const [internalTab, setInternalTab] = useState(tabs[0]?.id ?? '');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = (id: string) => {
    onActiveTabChange?.(id);
    if (controlledTab === undefined) setInternalTab(id);
  };
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Mount → next tick → animate-in. Unmount with delay so the slide-out is visible.
  useEffect(() => {
    if (open) {
      setMounted(true);
      // trigger animate-in on next paint
      requestAnimationFrame(() => requestAnimationFrame(() => setDragY(0)));
    } else if (mounted) {
      // animate-out, then unmount after the transition completes
      const t = setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, mounted]);

  // Body scroll lock while sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Opened with a target finding (highlight tap in the page body): bring its
  // card into view inside the sheet once the slide-in transition settles.
  // The sheet is position:fixed, so scrollIntoView() would scroll the WINDOW,
  // not this container — scroll the sheet's own scroll body directly (offset-
  // parent-independent: by the card's delta from the scroller's top).
  useEffect(() => {
    if (!open || !scrollToKey) return;
    const t = setTimeout(() => {
      const root = sheetRef.current;
      const card = root?.querySelector(`[data-finding-key="${CSS.escape(scrollToKey)}"]`) as HTMLElement | null;
      const scroller = root?.querySelector('[data-sheet-scroll]') as HTMLElement | null;
      if (card && scroller) {
        scroller.scrollTop += card.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
      }
    }, 320);
    return () => clearTimeout(t);
  }, [open, scrollToKey, mounted]);

  if (tabs.length === 0) return null;
  const active = tabs.find(t => t.id === activeTab) ?? tabs[0]!;

  // Touch handlers - swipe-down to dismiss
  const handleTouchStart = (e: TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? null;
  };
  const handleTouchMove = (e: TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = (e.touches[0]?.clientY ?? 0) - dragStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const handleTouchEnd = () => {
    if (dragY > SWIPE_DISMISS_THRESHOLD_PX) {
      setOpen(false);
    }
    setDragY(0);
    dragStartY.current = null;
  };

  const closing = mounted && !open;

  return (
    <>
      {/* Floating trigger pill */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          class="xl:hidden fixed left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink-strong text-white text-sm font-semibold shadow-lg hover:bg-ink active:scale-95 transition-all duration-150"
          style="bottom: calc(5rem + env(safe-area-inset-bottom, 0px));"
        >
          {scoreBadge}
          <span>View findings{totalFindings !== undefined ? ` (${totalFindings})` : ''}</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
        </button>
      )}

      {/* Backdrop - fades in/out */}
      {mounted && (
        <div
          class="xl:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-[280ms]"
          style={`opacity: ${closing ? 0 : 1};`}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sheet - slides up from bottom, follows drag */}
      {mounted && (
        <div
          ref={sheetRef}
          class="xl:hidden fixed inset-x-0 bottom-0 z-50 bg-surface rounded-t-2xl shadow-2xl flex flex-col"
          style={`
            max-height: 85vh;
            padding-bottom: env(safe-area-inset-bottom, 0);
            transform: translateY(${closing ? '100%' : `${dragY}px`});
            transition: transform ${dragStartY.current === null ? '280ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'};
          `}
        >
          {/* Grab handle - also the touch target for drag */}
          <div
            class="w-full py-3.5 flex justify-center cursor-pointer"
            onTouchStart={handleTouchStart as unknown as EventListener}
            onTouchMove={handleTouchMove as unknown as EventListener}
            onTouchEnd={handleTouchEnd}
            onClick={() => setOpen(false)}
          >
            <div class="w-10 h-1 rounded-full bg-hairline" />
          </div>

          {/* Tab strip */}
          <div class="flex border-b border-hairline overflow-x-auto px-2 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                class={`shrink-0 px-3 py-3 min-h-11 text-xs font-medium transition-colors border-b-2 ${
                  tab.id === active.id
                    ? 'text-ink-strong border-accent-support'
                    : 'text-muted border-transparent hover:text-ink'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span class={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    tab.id === active.id ? 'bg-accent/10 text-accent' : 'bg-hairline/40 text-muted'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Active tab body */}
          <div data-sheet-scroll class="overflow-y-auto p-4 flex-1 overscroll-contain">
            {active.body}
          </div>
        </div>
      )}
    </>
  );
}
