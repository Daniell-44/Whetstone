/**
 * How a mini-briefing reads, in one place.
 *
 * Two surfaces render this: the live question box at /audit?mode=question
 * (hydrated, mid-run) and the published reader-question page (server-rendered,
 * no JavaScript). They must not drift, because the whole claim being made is
 * that the thing you were shown live is the thing that got published.
 *
 * The row grammar is the cross-document worked example's: mono uppercase
 * kickers, bg-paper rows, quotes behind a left rule. Stance is named in words
 * first, so nothing here depends on telling two hues apart.
 */
import type { ClientMiniBriefing, MiniSource, Stance } from '../../../functions/_lib/premise/mini';

/** The stance in words, always. Since the de-hue below, the word IS the channel. */
export const STANCE_LABEL: Record<Stance, string> = {
  contests: 'Contests',
  complicates: 'Complicates',
  supports: 'Supports',
};

// Matches the cross-document worked example, which is what makes a briefing
// read the same whether the engine was handed documents or a bare question.
//
// STANCE TAKES NO HUE, and this is deliberate rather than a shortage of ideas.
//
// It used to borrow `spec-left`/`spec-right`, which mean the SOURCE SPECTRUM
// everywhere else on the site: left to right, politically. A source that
// contests a claim is not thereby right-of-centre, so on any page carrying both
// a spectrum and a stance chip the same hue said two different things. For a
// colourblind reader that is worse than no colour at all, because the redundant
// channel becomes a false signal: the whole point of the redundancy is that it
// agrees with the word, and here it disagreed.
//
// Every hue in this palette is already spoken for. Redline is reserved for
// engine detections, drafting blue is the left pole and interaction, oxide is
// the right pole. So stance is marked by WEIGHT and TONE instead, and keeps
// three honest channels: the word first, position second (dispute always
// leads), weight third. Daniel, 2026-08-17: weight and tone, no hue.
const STANCE_CLASS: Record<Stance, string> = {
  contests: 'text-ink-strong font-bold',
  complicates: 'text-ink',
  supports: 'text-muted',
};

export function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** One source, verified quote behind a rule, attribution above it. */
export function SourceRow({ s }: { s: MiniSource }) {
  const stance = s.stance ?? 'supports';
  const url = s.resolvedUrl ?? s.url;
  const host = hostOf(url);
  return (
    <div>
      <p class={`font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${STANCE_CLASS[stance]} m-0`}>
        {STANCE_LABEL[stance]} · {s.who}{s.publication && s.publication !== s.who ? ` · ${s.publication}` : ''}
      </p>
      <p class="text-xs text-ink border-l-2 border-hairline pl-2 m-0 leading-snug">
        {/* Quotation marks appear only around a passage that survived the
            character-exact check. An unverified source still has `position`,
            which is our paraphrase, and it must never be dressed as a quote. */}
        {s.quote ? <>&ldquo;{s.quote}&rdquo;</> : s.position}
        {url && host && (
          <>
            {' '}
            <a href={url} target="_blank" rel="noopener noreferrer" class="text-accent-support hover:underline">({host})</a>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * `showQuestion` exists so the published page can turn it off. That page
 * carries the question as its H1, and printing it again at the top of the body
 * is the exact habit that once got a briefing page to 101 type registers: one
 * fact, two renderings, neither removed. In the live prompt box the question
 * is not a heading anywhere else, so there it stays on.
 */
export default function MiniBriefingBody(
  { briefing, showQuestion = true }: { briefing: ClientMiniBriefing; showQuestion?: boolean },
) {
  return (
    <div class="space-y-4">
      {showQuestion && <p class="font-serif text-lg text-ink-strong leading-snug m-0">{briefing.question}</p>}
      {briefing.conclusion && (
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">What the answer turns on</p>
          <p class="text-sm text-ink m-0 leading-snug">{briefing.conclusion}</p>
        </div>
      )}

      {briefing.premises.length > 0 && (
        <div>
          {/* Same noun as the waiting stage on purpose. The reader watched
              "the claims the answer rests on" go past; renaming them premises
              at the finish makes them look like different objects. */}
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">The claims, checked against sources</p>
          <div class="space-y-1.5">
            {briefing.premises.map((p, i) => (
              <div key={i} class="rounded border border-hairline bg-paper px-3 py-2.5">
                <p class="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted m-0">Claim {i + 1}</p>
                <p class="text-sm text-ink m-0 leading-snug">{p.claim}</p>
                {p.load && <p class="text-xs text-muted mt-1 mb-2 leading-snug">{p.load}</p>}
                {p.sources.length > 0 && (
                  <div class="border-t border-dashed border-hairline pt-2 space-y-2">
                    {p.sources.map((s, j) => <SourceRow key={j} s={s} />)}
                  </div>
                )}
                {p.undisputed && (
                  <p class="text-xs text-muted mt-2 m-0 leading-snug">
                    No published objection was found for this claim. That is not agreement with it.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {briefing.opposing.length > 0 && (
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">Published disagreement</p>
          <div class="rounded border border-hairline bg-paper px-3 py-2.5 space-y-2">
            {briefing.opposing.map((s, j) => <SourceRow key={j} s={s} />)}
          </div>
        </div>
      )}

      {briefing.limits.length > 0 && (
        <div>
          <p class="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-1.5">What this cannot promise</p>
          <ul class="list-none p-0 m-0 space-y-1">
            {briefing.limits.map((l, i) => (
              <li key={i} class="text-xs text-muted leading-relaxed">{l}</li>
            ))}
          </ul>
        </div>
      )}

      <p class="text-xs text-muted m-0 leading-relaxed">
        Everything in quotation marks above was checked word-for-word against its source page
        during this run; the rest is reported in our words. Quotes that could not be verified
        were dropped, not softened.
      </p>
    </div>
  );
}
