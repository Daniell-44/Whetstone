import type { AuditDiff, CounterargumentDiff } from '../../../functions/_lib/documents/diff';
import type { NamedFallacy, LoadedLanguage } from '../../lib/audit';
import type { Counterargument } from '../../lib/counterargument';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
};

function FallacyPill({ fallacy, variant }: { fallacy: NamedFallacy; variant: 'removed' | 'added' | 'persisted' }) {
  const border = variant === 'removed' ? 'border-red-200 bg-red-50'
               : variant === 'added'   ? 'border-emerald-200 bg-emerald-50'
               :                         'border-gray-200 bg-gray-50';
  const badge = SEVERITY_BADGE[fallacy.severity] ?? 'bg-gray-100 text-gray-600';
  return (
    <div class={`rounded-xl border p-4 ${border}`}>
      <div class="flex items-start justify-between gap-2 mb-2">
        <p class="text-sm font-semibold text-gray-900">{fallacy.name}</p>
        <span class={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge}`}>
          {fallacy.severity}
        </span>
      </div>
      <blockquote class="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-3 mb-2 leading-relaxed">
        "{fallacy.quote}"
      </blockquote>
      <p class="text-xs text-gray-600 leading-relaxed">{fallacy.explanation}</p>
    </div>
  );
}

function LoadedLanguagePill({ item, variant }: { item: LoadedLanguage; variant: 'removed' | 'added' | 'persisted' }) {
  const cls = variant === 'removed' ? 'bg-red-50 border-red-200'
            : variant === 'added'   ? 'bg-emerald-50 border-emerald-200'
            :                         'bg-gray-50 border-gray-200';
  return (
    <div class={`rounded-lg border px-4 py-3 ${cls}`}>
      <div class="flex items-start gap-2 flex-wrap mb-1">
        <span class="text-sm font-medium text-gray-900">"{item.phrase}"</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0 mt-0.5">
          {item.technique}
        </span>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">{item.explanation}</p>
    </div>
  );
}

function CounterargCard({ c }: { c: Counterargument }) {
  return (
    <div class="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-3">
      <p class="text-sm font-semibold text-violet-900 leading-snug">{c.position}</p>
      <div class="space-y-1.5 pl-4 border-l-2 border-violet-300">
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
        <p class="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">What your draft misses</p>
        <p class="text-sm text-gray-700 leading-relaxed">{c.missedByDraft}</p>
      </div>
    </div>
  );
}

function SideBySide({ labelA, labelB, children }: {
  labelA: string;
  labelB: string;
  children: [preact.ComponentChildren, preact.ComponentChildren];
}) {
  return (
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{labelA}</p>
        {children[0]}
      </div>
      <div>
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{labelB}</p>
        {children[1]}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat pill for summary card
// ---------------------------------------------------------------------------

function StatPill({ label, value, tone }: { label: string; value: string | number; tone: 'good' | 'bad' | 'neutral' }) {
  const cls = tone === 'good'    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : tone === 'bad'     ? 'bg-red-50 border-red-200 text-red-700'
            :                      'bg-gray-50 border-gray-200 text-gray-600';
  return (
    <div class={`rounded-xl border px-4 py-3 text-center ${cls}`}>
      <p class="text-xl font-bold">{value}</p>
      <p class="text-xs mt-0.5">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface VersionInfo {
  version_number: number;
  content:        string;
  created_at:     number;
}

interface Props {
  from:           VersionInfo;
  to:             VersionInfo;
  auditDiff:      AuditDiff;
  counterargDiff: CounterargumentDiff;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ComparisonView({ from, to, auditDiff, counterargDiff }: Props) {
  const s = auditDiff.summary;

  return (
    <div class="space-y-10">

      {/* Summary card */}
      <section class="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Changes from v{from.version_number} → v{to.version_number}
        </h2>

        {!auditDiff.fromAudited && !auditDiff.toAudited ? (
          <p class="text-sm text-gray-400">Neither version has been audited — run the analysis to compare findings.</p>
        ) : (
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatPill
              label="Fallacies removed"
              value={s.fallaciesRemoved}
              tone={s.fallaciesRemoved > 0 ? 'good' : 'neutral'}
            />
            <StatPill
              label="Fallacies added"
              value={s.fallaciesAdded}
              tone={s.fallaciesAdded > 0 ? 'bad' : 'neutral'}
            />
            <StatPill
              label="Persisted"
              value={s.fallaciesPersisted}
              tone={s.fallaciesPersisted > 0 ? 'bad' : 'neutral'}
            />
            <StatPill
              label="Loaded lang removed"
              value={s.loadedRemoved}
              tone={s.loadedRemoved > 0 ? 'good' : 'neutral'}
            />
            <StatPill
              label="Loaded lang added"
              value={s.loadedAdded}
              tone={s.loadedAdded > 0 ? 'bad' : 'neutral'}
            />
            <StatPill
              label="Central claim"
              value={s.centralClaimChanged ? 'Changed' : 'Same'}
              tone={s.centralClaimChanged ? 'neutral' : 'neutral'}
            />
          </div>
        )}
      </section>

      {/* Content diff */}
      <section>
        <details class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <summary class="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-gray-400 cursor-pointer list-none hover:bg-gray-50 transition-colors">
            ↳ Draft content (v{from.version_number} vs v{to.version_number})
          </summary>
          <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <div class="p-5">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Version {from.version_number} · {formatDate(from.created_at)}
              </p>
              <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{from.content}</p>
            </div>
            <div class="p-5">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Version {to.version_number} · {formatDate(to.created_at)}
              </p>
              <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{to.content}</p>
            </div>
          </div>
        </details>
      </section>

      {/* Toulmin comparison */}
      {(auditDiff.fromAudited || auditDiff.toAudited) && (
        <section class="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">Argument Structure</h2>

          {auditDiff.centralClaim.changed && (
            <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p class="text-xs font-semibold text-amber-700 uppercase tracking-wide">Central claim changed</p>
              <SideBySide labelA={`v${from.version_number}`} labelB={`v${to.version_number}`}>
                {[
                  <p class="text-sm text-gray-700 leading-relaxed">{auditDiff.centralClaim.from ?? '—'}</p>,
                  <p class="text-sm text-gray-700 leading-relaxed">{auditDiff.centralClaim.to ?? '—'}</p>,
                ]}
              </SideBySide>
            </div>
          )}

          {(auditDiff.toulmin.from ?? auditDiff.toulmin.to) && (
            <div class="space-y-4">
              {(['claim', 'grounds', 'weakestLink'] as const).map(field => {
                const fromVal = auditDiff.toulmin.from?.[field] ?? '—';
                const toVal   = auditDiff.toulmin.to?.[field]   ?? '—';
                const label   = field === 'weakestLink' ? 'Weakest link' : field.charAt(0).toUpperCase() + field.slice(1);
                return (
                  <div key={field}>
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
                    <SideBySide labelA={`v${from.version_number}`} labelB={`v${to.version_number}`}>
                      {[
                        <p class="text-sm text-gray-700 leading-relaxed">{fromVal}</p>,
                        <p class="text-sm text-gray-700 leading-relaxed">{toVal}</p>,
                      ]}
                    </SideBySide>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Fallacy diff */}
      {(auditDiff.fromAudited || auditDiff.toAudited) && (
        <section class="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">Fallacy Changes</h2>

          {auditDiff.fallacies.removed.length === 0 &&
           auditDiff.fallacies.added.length === 0 &&
           auditDiff.fallacies.persisted.length === 0 ? (
            <p class="text-sm text-gray-400">No fallacy data to compare — run the audit on both versions.</p>
          ) : (
            <>
              {auditDiff.fallacies.removed.length > 0 && (
                <div>
                  <p class="text-xs font-semibold text-emerald-700 uppercase tracking-widest mb-3">
                    Removed ({auditDiff.fallacies.removed.length})
                  </p>
                  <div class="space-y-3">
                    {auditDiff.fallacies.removed.map((f, i) => (
                      <FallacyPill key={i} fallacy={f} variant="removed" />
                    ))}
                  </div>
                </div>
              )}

              {auditDiff.fallacies.added.length > 0 && (
                <div>
                  <p class="text-xs font-semibold text-red-600 uppercase tracking-widest mb-3">
                    Added ({auditDiff.fallacies.added.length})
                  </p>
                  <div class="space-y-3">
                    {auditDiff.fallacies.added.map((f, i) => (
                      <FallacyPill key={i} fallacy={f} variant="added" />
                    ))}
                  </div>
                </div>
              )}

              {auditDiff.fallacies.persisted.length > 0 && (
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                    Still present ({auditDiff.fallacies.persisted.length})
                  </p>
                  <div class="space-y-3">
                    {auditDiff.fallacies.persisted.map((f, i) => (
                      <FallacyPill key={i} fallacy={f} variant="persisted" />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Loaded language diff */}
      {(auditDiff.fromAudited || auditDiff.toAudited) && (
        <section class="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">Loaded Language Changes</h2>

          {auditDiff.loadedLanguage.removed.length === 0 &&
           auditDiff.loadedLanguage.added.length === 0 &&
           auditDiff.loadedLanguage.persisted.length === 0 ? (
            <p class="text-sm text-gray-400">No loaded language data to compare.</p>
          ) : (
            <>
              {auditDiff.loadedLanguage.removed.length > 0 && (
                <div>
                  <p class="text-xs font-semibold text-emerald-700 uppercase tracking-widest mb-3">
                    Removed ({auditDiff.loadedLanguage.removed.length})
                  </p>
                  <div class="space-y-2">
                    {auditDiff.loadedLanguage.removed.map((item, i) => (
                      <LoadedLanguagePill key={i} item={item} variant="removed" />
                    ))}
                  </div>
                </div>
              )}

              {auditDiff.loadedLanguage.added.length > 0 && (
                <div>
                  <p class="text-xs font-semibold text-red-600 uppercase tracking-widest mb-3">
                    Added ({auditDiff.loadedLanguage.added.length})
                  </p>
                  <div class="space-y-2">
                    {auditDiff.loadedLanguage.added.map((item, i) => (
                      <LoadedLanguagePill key={i} item={item} variant="added" />
                    ))}
                  </div>
                </div>
              )}

              {auditDiff.loadedLanguage.persisted.length > 0 && (
                <div>
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                    Still present ({auditDiff.loadedLanguage.persisted.length})
                  </p>
                  <div class="space-y-2">
                    {auditDiff.loadedLanguage.persisted.map((item, i) => (
                      <LoadedLanguagePill key={i} item={item} variant="persisted" />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Counterargument side-by-side */}
      {(counterargDiff.fromGenerated || counterargDiff.toGenerated) && (
        <section class="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">Counterarguments</h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Version {from.version_number}
              </p>
              {!counterargDiff.fromGenerated ? (
                <p class="text-sm text-gray-400">Not generated for this version.</p>
              ) : (
                <div class="space-y-3">
                  {counterargDiff.counterarguments.from.map((c, i) => (
                    <CounterargCard key={i} c={c} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Version {to.version_number}
              </p>
              {!counterargDiff.toGenerated ? (
                <p class="text-sm text-gray-400">Not generated for this version.</p>
              ) : (
                <div class="space-y-3">
                  {counterargDiff.counterarguments.to.map((c, i) => (
                    <CounterargCard key={i} c={c} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
