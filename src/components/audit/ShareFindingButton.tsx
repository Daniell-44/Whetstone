import { useState } from 'preact/hooks';

interface Props {
  label:    string;
  quote:    string;
  severity: string;
  source?:  string;  // e.g. scorecard slug; passed through to the card
}

export default function ShareFindingButton({ label, quote, severity, source }: Props) {
  const [open, setOpen] = useState(false);

  const params = new URLSearchParams({ label, quote, severity });
  if (source) params.set('source', source);
  const cardUrl = `/api/card.svg?${params.toString()}`;
  const absoluteCardUrl = (typeof window !== 'undefined' ? window.location.origin : '') + cardUrl;

  return (
    <div class="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        class="text-[10px] text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
        title="Share this finding"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
        Share
      </button>

      {open && (
        <div
          class="absolute z-30 right-0 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white shadow-lg p-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Card preview */}
          <div class="rounded-md overflow-hidden border border-gray-100">
            <img
              src={cardUrl}
              alt="Shareable card preview"
              loading="lazy"
              style="width: 100%; aspect-ratio: 1200/675; background: #f9fafb;"
            />
          </div>

          {/* Actions */}
          <div class="flex gap-2">
            <a
              href={cardUrl}
              download={`whetstone-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}.svg`}
              class="flex-1 text-center px-2 py-1.5 rounded-md text-[11px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              ↓ SVG
            </a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(absoluteCardUrl);
                setOpen(false);
              }}
              class="flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Copy URL
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`"${quote}" - flagged as ${label} by The Whetstone`)}&url=${encodeURIComponent(absoluteCardUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              class="flex-1 text-center px-2 py-1.5 rounded-md text-[11px] font-medium text-white bg-gray-900 hover:bg-black transition-colors"
            >
              𝕏 Post
            </a>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            class="text-[10px] text-gray-400 hover:text-gray-600 w-full text-center"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
