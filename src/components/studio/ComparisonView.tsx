import type { AuditDiff, CounterargumentDiff } from '../../../functions/_lib/documents/diff';
import type { NamedFallacy, LoadedLanguage } from '../../lib/audit';
import type { Counterargument } from '../../lib/counterargument';
import LabelWithTooltip from '../ui/LabelWithTooltip';
import { getLabels } from '../../lib/labels';
import type { TerminologyPreference } from '../../lib/labels';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-sev-high/10 text-sev-high',
  medium: 'bg-sev-med/10 text-sev-med',
  low:    'bg-sev-low/10 text-sev-low',
};

function FallacyPill({ fallacy, variant }: { fallacy: NamedFallacy; variant: 'removed' | 'added' | 'persisted' }) {
  // removed = fixed in the newer draft (an improvement → factual);
  // added   = a new problem the newer draft introduced (a regression → redline).
  const border = variant === 'removed' ? 'border-factual/30 bg-factual-bg'
               : variant === 'added'   ? 'border-accent/40 bg-accent/5'
               :                         'border-hairline bg-paper';
  const badge = SEVERITY_BADGE[fallacy.severity] ?? 'bg-hairline/40 text-ink';
  return (
    <div class={`rounded-xl border p-4 ${border}`}>
      <div class="flex items-start justify-between gap-2 mb-2">
        <p class="text-sm font-semibold text-ink-strong">{fallacy.name}</p>
        <span class={`text-xs px-2 py-0.5 rounded-[2px] font-mono font-medium shrink-0 ${badge}`}>
          {fallacy.severity}
        </span>
      </div>
      <blockquote class="text-xs italic text-ink border-l-2 border-hairline pl-3 mb-2 leading-relaxed">
        "{fallacy.quote}"
      </blockquote>
      <p class="text-xs text-ink leading-relaxed">{fallacy.explanation}</p>
    </div>
  );
}

function LoadedLanguagePill({ item, variant }: { item: LoadedLanguage; variant: 'removed' | 'added' | 'persisted' }) {
  const cls = variant === 'removed' ? 'bg-factual-bg border-factual/30'
            : variant === 'added'   ? 'bg-accent/5 border-accent/40'
            :                         'bg-paper border-hairline';
  return (
    <div class={`rounded-lg border px-4 py-3 ${cls}`}>
      <div class="flex items-start gap-2 flex-wrap mb-1">
        <span class="text-sm font-medium text-ink-strong">"{item.phrase}"</span>
        <span class="text-xs px-2 py-0.5 rounded-[2px] font-mono bg-hairline/40 text-ink shrink-0 mt-0.5">
          {item.technique}
        </span>
      </div>
      <p class="text-xs text-muted leading-relaxed">{item.explanation}</p>
    </div>
  );
}

function CounterargCard({ c, preference }: { c: Counterargument; preference?: TerminologyPreference }) {
  return (
    <div class="rounded-xl border border-hairline bg-paper p-4 space-y-3">
      <p class="text-sm font-semibold text-ink-strong leading-snug">{c.position}</p>
      <div class="space-y-1.5 pl-4 border-l-2 border-hairline">
        <div>
          <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
            <LabelWithTooltip label="toulminClaim" preference={preference} />
          </p>
          <p class="text-sm text-ink leading-relaxed">{c.strongestCase.claim}</p>
        </div>
        <div>
          <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
            <LabelWithTooltip label="toulminGrounds" preference={preference} />
          </p>
          <p class="text-sm text-ink leading-relaxed">{c.strongestCase.grounds}</p>
        </div>
        <div>
          <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
            <LabelWithTooltip label="toulminWarrant" preference={preference} />
          </p>
          <p class="text-sm text-ink leading-relaxed">{c.strongestCase.warrant}</p>
        </div>
      </div>
      <div class="rounded-lg bg-surface border border-hairline p-3">
        <p class="text-xs font-mono font-semibold text-muted uppercase tracking-wide mb-1">
          <LabelWithTooltip label="missedByDraft" preference={preference} />
        </p>
        <p class="text-sm text-ink leading-relaxed">{c.missedByDraft}</p>
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
        <p class="text-xs font-semibold text-muted uppercase tracking-widest mb-2">{labelA}</p>
        {children[0]}
      </div>
      <div>
        <p class="text-xs font-semibold text-muted uppercase tracking-widest mb-2">{labelB}</p>
        {children[1]}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat pill for summary card
// ---------------------------------------------------------------------------

function StatPill({ label, value, tone }: { label: string; value: string | number; tone: 'good' | 'bad' | 'neutral' }) {
  const cls = tone === 'good'    ? 'bg-factual-bg border-factual/30 text-factual'
            : tone === 'bad'     ? 'bg-accent/5 border-accent/40 text-accent'
            :                      'bg-paper border-hairline text-ink';
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
  from:                   VersionInfo;
  to:                     VersionInfo;
  auditDiff:              AuditDiff;
  counterargDiff:         CounterargumentDiff;
  terminologyPreference?: TerminologyPreference;
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ComparisonView({ from, to, auditDiff, counterargDiff, terminologyPreference }: Props) {
  const s      = auditDiff.summary;
  const LABELS = getLabels(terminologyPreference);

  return (
    <div class="space-y-10">

      {/* Summary card */}
      <section class="rounded-xl border border-hairline bg-surface p-6 space-y-4">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">
          Changes from v{from.version_number} → v{to.version_number}
        </h2>

        {!auditDiff.fromAudited && !auditDiff.toAudited ? (
          <p class="text-sm text-muted">Neither version has been audited - run the analysis to compare findings.</p>
        ) : (
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatPill
              label={`${LABELS.namedFallacies} fixed`}
              value={s.fallaciesRemoved}
              tone={s.fallaciesRemoved > 0 ? 'good' : 'neutral'}
            />
            <StatPill
              label={`${LABELS.namedFallacies} added`}
              value={s.fallaciesAdded}
              tone={s.fallaciesAdded > 0 ? 'bad' : 'neutral'}
            />
            <StatPill
              label={LABELS.diffPersisted}
              value={s.fallaciesPersisted}
              tone={s.fallaciesPersisted > 0 ? 'bad' : 'neutral'}
            />
            <StatPill
              label={`${LABELS.loadedLanguage} fixed`}
              value={s.loadedRemoved}
              tone={s.loadedRemoved > 0 ? 'good' : 'neutral'}
            />
            <StatPill
              label={`${LABELS.loadedLanguage} added`}
              value={s.loadedAdded}
              tone={s.loadedAdded > 0 ? 'bad' : 'neutral'}
            />
            <StatPill
              label={LABELS.centralClaim}
              value={s.centralClaimChanged ? 'Changed' : 'Same'}
              tone="neutral"
            />
          </div>
        )}
      </section>

      {/* Content diff */}
      <section>
        <details class="rounded-xl border border-hairline bg-surface overflow-hidden">
          <summary class="px-6 py-4 text-xs font-semibold uppercase tracking-widest text-muted cursor-pointer list-none hover:bg-paper transition-colors">
            ↳ Draft content (v{from.version_number} vs v{to.version_number})
          </summary>
          <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-hairline">
            <div class="p-5">
              <p class="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                Version {from.version_number} · {formatDate(from.created_at)}
              </p>
              <p class="text-sm text-ink leading-relaxed whitespace-pre-wrap">{from.content}</p>
            </div>
            <div class="p-5">
              <p class="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                Version {to.version_number} · {formatDate(to.created_at)}
              </p>
              <p class="text-sm text-ink leading-relaxed whitespace-pre-wrap">{to.content}</p>
            </div>
          </div>
        </details>
      </section>

      {/* Toulmin comparison */}
      {(auditDiff.fromAudited || auditDiff.toAudited) && (
        <section class="rounded-xl border border-hairline bg-surface p-6 space-y-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">
            <LabelWithTooltip label="toulmin" preference={terminologyPreference} />
          </h2>

          {auditDiff.centralClaim.changed && (
            <div class="rounded-xl border border-hairline bg-paper p-4 space-y-2">
              <p class="text-xs font-mono font-semibold text-muted uppercase tracking-wide">
                <LabelWithTooltip label="centralClaim" preference={terminologyPreference} /> changed
              </p>
              <SideBySide labelA={`v${from.version_number}`} labelB={`v${to.version_number}`}>
                {[
                  <p class="text-sm text-ink leading-relaxed">{auditDiff.centralClaim.from ?? '-'}</p>,
                  <p class="text-sm text-ink leading-relaxed">{auditDiff.centralClaim.to ?? '-'}</p>,
                ]}
              </SideBySide>
            </div>
          )}

          {(auditDiff.toulmin.from ?? auditDiff.toulmin.to) && (
            <div class="space-y-4">
              {(['claim', 'grounds', 'weakestLink'] as const).map(field => {
                const fromVal = auditDiff.toulmin.from?.[field] ?? '-';
                const toVal   = auditDiff.toulmin.to?.[field]   ?? '-';
                const labelKey = field === 'claim' ? 'toulminClaim'
                               : field === 'grounds' ? 'toulminGrounds'
                               : 'weakestLink';
                return (
                  <div key={field}>
                    <p class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                      <LabelWithTooltip label={labelKey} preference={terminologyPreference} />
                    </p>
                    <SideBySide labelA={`v${from.version_number}`} labelB={`v${to.version_number}`}>
                      {[
                        <p class="text-sm text-ink leading-relaxed">{fromVal}</p>,
                        <p class="text-sm text-ink leading-relaxed">{toVal}</p>,
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
        <section class="rounded-xl border border-hairline bg-surface p-6 space-y-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">
            <LabelWithTooltip label="namedFallacies" preference={terminologyPreference} />
          </h2>

          {auditDiff.fallacies.removed.length === 0 &&
           auditDiff.fallacies.added.length === 0 &&
           auditDiff.fallacies.persisted.length === 0 ? (
            <p class="text-sm text-muted">No reasoning pattern data to compare - run the audit on both versions.</p>
          ) : (
            <>
              {auditDiff.fallacies.removed.length > 0 && (
                <div>
                  <p class="text-xs font-mono font-semibold text-factual uppercase tracking-widest mb-3">
                    <LabelWithTooltip label="diffRemoved" preference={terminologyPreference} /> ({auditDiff.fallacies.removed.length})
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
                  <p class="text-xs font-mono font-semibold text-accent uppercase tracking-widest mb-3">
                    <LabelWithTooltip label="diffAdded" preference={terminologyPreference} /> ({auditDiff.fallacies.added.length})
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
                  <p class="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                    <LabelWithTooltip label="diffPersisted" preference={terminologyPreference} /> ({auditDiff.fallacies.persisted.length})
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
        <section class="rounded-xl border border-hairline bg-surface p-6 space-y-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">
            <LabelWithTooltip label="loadedLanguage" preference={terminologyPreference} />
          </h2>

          {auditDiff.loadedLanguage.removed.length === 0 &&
           auditDiff.loadedLanguage.added.length === 0 &&
           auditDiff.loadedLanguage.persisted.length === 0 ? (
            <p class="text-sm text-muted">No word choice data to compare.</p>
          ) : (
            <>
              {auditDiff.loadedLanguage.removed.length > 0 && (
                <div>
                  <p class="text-xs font-mono font-semibold text-factual uppercase tracking-widest mb-3">
                    <LabelWithTooltip label="diffRemoved" preference={terminologyPreference} /> ({auditDiff.loadedLanguage.removed.length})
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
                  <p class="text-xs font-mono font-semibold text-accent uppercase tracking-widest mb-3">
                    <LabelWithTooltip label="diffAdded" preference={terminologyPreference} /> ({auditDiff.loadedLanguage.added.length})
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
                  <p class="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                    <LabelWithTooltip label="diffPersisted" preference={terminologyPreference} /> ({auditDiff.loadedLanguage.persisted.length})
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
        <section class="rounded-xl border border-hairline bg-surface p-6 space-y-6">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-muted">
            <LabelWithTooltip label="counterarguments" preference={terminologyPreference} />
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p class="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                Version {from.version_number}
              </p>
              {!counterargDiff.fromGenerated ? (
                <p class="text-sm text-muted">Not generated for this version.</p>
              ) : (
                <div class="space-y-3">
                  {counterargDiff.counterarguments.from.map((c, i) => (
                    <CounterargCard key={i} c={c} preference={terminologyPreference} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <p class="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
                Version {to.version_number}
              </p>
              {!counterargDiff.toGenerated ? (
                <p class="text-sm text-muted">Not generated for this version.</p>
              ) : (
                <div class="space-y-3">
                  {counterargDiff.counterarguments.to.map((c, i) => (
                    <CounterargCard key={i} c={c} preference={terminologyPreference} />
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
