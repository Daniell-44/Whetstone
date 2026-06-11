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
}

const SWIPE_DISMISS_THRESHOLD_PX = 80;

export default function MobileFindingsSheet({ tabs, scoreBadge, totalFindings }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');
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

  if (tabs.length === 0) return null;
  const active = tabs.find(t => t.id === activeTab) ?? tabs[0]!;

  // Touch handlers — swipe-down to dismiss
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
          class="sm:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-lg hover:bg-gray-800 active:scale-95 transition-all duration-150"
          style="padding-bottom: calc(0.625rem + env(safe-area-inset-bottom, 0) / 4);"
        >
          {scoreBadge}
          <span>View findings{totalFindings !== undefined ? ` (${totalFindings})` : ''}</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
        </button>
      )}

      {/* Backdrop — fades in/out */}
      {mounted && (
        <div
          class="sm:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-[280ms]"
          style={`opacity: ${closing ? 0 : 1};`}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sheet — slides up from bottom, follows drag */}
      {mounted && (
        <div
          ref={sheetRef}
          class="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
          style={`
            max-height: 85vh;
            padding-bottom: env(safe-area-inset-bottom, 0);
            transform: translateY(${closing ? '100%' : `${dragY}px`});
            transition: transform ${dragStartY.current === null ? '280ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'};
          `}
        >
          {/* Grab handle — also the touch target for drag */}
          <div
            class="w-full pt-2.5 pb-2 flex justify-center cursor-pointer"
            onTouchStart={handleTouchStart as unknown as EventListener}
            onTouchMove={handleTouchMove as unknown as EventListener}
            onTouchEnd={handleTouchEnd}
            onClick={() => setOpen(false)}
          >
            <div class="w-10 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Tab strip */}
          <div class="flex border-b border-gray-100 overflow-x-auto px-2 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                class={`shrink-0 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  tab.id === active.id
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span class={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    tab.id === active.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Active tab body */}
          <div class="overflow-y-auto p-4 flex-1 overscroll-contain">
            {active.body}
          </div>
        </div>
      )}
    </>
  );
}
