import { useState } from 'preact/hooks';
import type { TopicData, TopicSource, ArticleType } from './types';
import { leaningStyle, spectrumPosition } from './types';

// ---------------------------------------------------------------------------
// Topic page - left/right spectrum of curated sources + cross-doc synthesis.
//
// Responsive strategy (mobile-first, no layout-position-encodes-leaning trap):
//   - Leaning is shown INSIDE each card (edge accent + pill + mini-bar), so it
//     survives expansion and reordering.
//   - Desktop adds an overview spectrum rail at the top (all dots at once).
//   - Mobile shows a compact "N left · N center · N right" summary instead of
//     the rail, and the cards stack full-width.
//   - Sources are ordered centre-first, then outward (abs leaning ascending).
// ---------------------------------------------------------------------------

const TYPE_LABEL: Record<ArticleType, string> = {
  news:     'News',
  opinion:  'Opinion',
  analysis: 'Analysis',
};

function OverviewSpectrum({ sources }: { sources: TopicSource[] }) {
  return (
    <div class="hidden sm:block">
      <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
        <span>Left</span><span>Center</span><span>Right</span>
      </div>
      <div class="relative h-2 rounded-full bg-gradient-to-r from-red-200 via-gray-200 to-blue-200">
        {sources.map((s) => {
          const st = leaningStyle(s.leaning);
          return (
            <div
              key={s.id}
              class={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white ${st.dot}`}
              style={`left: ${spectrumPosition(s.leaning)}%`}
              title={`${s.outlet} - ${st.label}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function MobileSummary({ sources }: { sources: TopicSource[] }) {
  const left   = sources.filter(s => s.leaning <= -15).length;
  const center = sources.filter(s => s.leaning > -15 && s.leaning < 15).length;
  const right  = sources.filter(s => s.leaning >= 15).length;
  return (
    <div class="sm:hidden flex items-center justify-center gap-2 text-xs text-gray-500">
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500" />{left} left</span>
      <span class="text-gray-300">·</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-gray-500" />{center} center</span>
      <span class="text-gray-300">·</span>
      <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500" />{right} right</span>
    </div>
  );
}

function SourceCard({ s }: { s: TopicSource }) {
  const [open, setOpen] = useState(false);
  const st = leaningStyle(s.leaning);

  return (
    <div class={`rounded-lg border border-gray-200 border-l-4 ${st.edge} bg-white`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        class="w-full text-left px-4 py-3 sm:px-5 sm:py-4"
      >
        {/* Header row: outlet · writer · date · type · leaning */}
        <div class="flex items-center gap-2 flex-wrap mb-1.5">
          <span class="text-xs font-semibold text-gray-800">{s.outlet}</span>
          {s.writer && <span class="text-xs text-gray-400">· {s.writer}</span>}
          <span class="text-xs text-gray-400">· {s.date}</span>
          <span class="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{TYPE_LABEL[s.type]}</span>
          <span class={`text-xs font-medium px-1.5 py-0.5 rounded ml-auto ${st.pill}`}>{st.label}</span>
        </div>

        {/* Mini-spectrum bar - intrinsic to the card, survives expansion */}
        <div class="relative h-1 rounded-full bg-gradient-to-r from-red-100 via-gray-100 to-blue-100 mb-2">
          <div
            class={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${st.dot}`}
            style={`left: ${spectrumPosition(s.leaning)}%`}
          />
        </div>

        <h3 class="font-serif text-base sm:text-lg text-gray-900 leading-snug mb-1">{s.title}</h3>
        <p class="text-xs sm:text-sm text-gray-500 leading-relaxed">{s.mainPoint}</p>

        <span class="inline-block mt-2 text-xs text-indigo-600 font-medium">
          {open ? 'Hide structure ↑' : 'See the structure ↓'}
        </span>
      </button>

      {open && (
        <div class="border-t border-gray-100 px-4 py-3 sm:px-5 sm:py-4 space-y-3 bg-gray-50/50">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Central claim</p>
            <p class="text-sm text-gray-800 leading-relaxed">{s.centralClaim}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Load-bearing assumption</p>
            <p class="text-sm text-gray-700 leading-relaxed">{s.keyWarrant}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Strongest version of this position</p>
            <p class="text-sm text-gray-700 leading-relaxed italic">{s.steelman}</p>
          </div>
          <a href={s.url} target="_blank" rel="noopener noreferrer" class="inline-block text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            Read the original →
          </a>
        </div>
      )}
    </div>
  );
}

export default function TopicPage({ data }: { data: TopicData }) {
  // Centre-first ordering: closest-to-centre first, then outward.
  const ordered = [...data.sources].sort((a, b) => Math.abs(a.leaning) - Math.abs(b.leaning));

  return (
    <div class="space-y-8">
      {/* Header */}
      <header class="space-y-4">
        <h1 class="font-serif text-2xl sm:text-4xl text-gray-900 leading-tight">{data.question}</h1>
        <div class="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-3">
          <OverviewSpectrum sources={data.sources} />
          <MobileSummary sources={data.sources} />
          <p class="text-sm sm:text-base text-gray-600 leading-relaxed">{data.framing}</p>
        </div>
      </header>

      {/* Takeaways */}
      <section class="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 sm:p-5 space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-indigo-600">Main takeaways</h2>
        <dl class="space-y-2.5">
          {([
            ['Where all sides agree', data.takeaways.agree],
            ['The real disagreement', data.takeaways.realDisagreement],
            ['What everyone assumes but nobody defends', data.takeaways.sharedAssumption],
            ['Where they talk past each other', data.takeaways.talkingPast],
          ] as const).map(([label, body], i) => (
            <div key={i}>
              <dt class="text-xs font-semibold text-gray-800">{label}</dt>
              <dd class="text-sm text-gray-600 leading-relaxed">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Sources */}
      <section class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">
          The sources ({ordered.length}) - centre-first
        </h2>
        {ordered.map((s) => <SourceCard key={s.id} s={s} />)}
      </section>
    </div>
  );
}
