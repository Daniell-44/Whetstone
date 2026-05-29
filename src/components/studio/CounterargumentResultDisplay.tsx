import type { CounterargumentResult } from '../../lib/counterargument';

export default function CounterargumentResultDisplay({ result }: { result: CounterargumentResult }) {
  return (
    <div class="space-y-6 border-t border-gray-100 pt-8">

      <div class="bg-violet-50 border border-violet-200 rounded-xl p-5">
        <p class="text-xs font-semibold text-violet-500 uppercase tracking-widest mb-2">
          Draft's Central Claim
        </p>
        <p class="text-gray-900 text-base leading-relaxed">{result.centralClaim}</p>
      </div>

      <section>
        <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
          Strongest Opposing Positions
        </h3>
        <div class="space-y-4">
          {result.counterarguments.map((c, i) => (
            <div key={i} class="rounded-xl border border-violet-200 bg-violet-50 p-5 space-y-4">

              <p class="text-sm font-semibold text-violet-900 leading-snug">{c.position}</p>

              <div class="space-y-2 pl-4 border-l-2 border-violet-300">
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Claim</p>
                  <p class="text-sm text-gray-700 leading-relaxed">{c.strongestCase.claim}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Grounds</p>
                  <p class="text-sm text-gray-700 leading-relaxed">{c.strongestCase.grounds}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Warrant</p>
                  <p class="text-sm text-gray-700 leading-relaxed">{c.strongestCase.warrant}</p>
                </div>
              </div>

              <div class="rounded-lg bg-white border border-violet-200 p-3">
                <p class="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">
                  What your draft misses
                </p>
                <p class="text-sm text-gray-700 leading-relaxed">{c.missedByDraft}</p>
              </div>

              <p class="text-xs text-gray-400 italic leading-relaxed">{c.why}</p>

            </div>
          ))}
        </div>
      </section>

      {result.notes && (
        <section>
          <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Notes</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{result.notes}</p>
        </section>
      )}

    </div>
  );
}
