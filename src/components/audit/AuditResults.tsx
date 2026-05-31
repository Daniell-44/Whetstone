import type { ComponentChildren } from 'preact';
import type { AuditResult, UnstatedWarrant, NamedFallacy, LoadedLanguage } from '../../lib/audit';
import { sortByPriority } from '../../lib/audit';
import LabelWithTooltip from '../ui/LabelWithTooltip';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_CARD: Record<string, string> = {
  high:   'bg-red-50 border-red-200',
  medium: 'bg-amber-50 border-amber-200',
  low:    'bg-gray-50 border-gray-200',
};

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
};

// ---------------------------------------------------------------------------
// Shared meta badges
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: string }) {
  const cls = SEVERITY_BADGE[severity] ?? 'bg-gray-100 text-gray-600';
  return (
    <span class={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cls}`}>
      {severity}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  return (
    <span class="text-xs text-gray-400 shrink-0">{confidence}%</span>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToulminRow({ label, text }: { label: ComponentChildren; text: string }) {
  return (
    <div class="pl-4 border-l-2 border-indigo-200">
      <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      <dd class="text-sm text-gray-700 leading-relaxed">{text}</dd>
    </div>
  );
}

function FallacyCard({ fallacy }: { fallacy: NamedFallacy }) {
  const cardCls = SEVERITY_CARD[fallacy.severity] ?? 'bg-gray-50 border-gray-200';

  return (
    <div class={`rounded-xl border p-4 ${cardCls}`}>
      <div class="flex items-start justify-between gap-2 mb-3">
        <p class="text-sm font-semibold text-gray-900">{fallacy.name}</p>
        <div class="flex items-center gap-1.5 shrink-0">
          <ConfidenceBadge confidence={fallacy.confidence} />
          <SeverityBadge severity={fallacy.severity} />
        </div>
      </div>
      <blockquote class="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-3 mb-2 leading-relaxed">
        "{fallacy.quote}"
      </blockquote>
      <p class="text-xs text-gray-600 leading-relaxed">{fallacy.explanation}</p>
    </div>
  );
}

function LoadedLanguageRow({ item }: { item: LoadedLanguage }) {
  return (
    <div class="px-4 py-3">
      <div class="flex items-start gap-2 mb-1 flex-wrap">
        <span class="text-sm font-medium text-gray-900">"{item.phrase}"</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 shrink-0 mt-0.5">
          {item.technique}
        </span>
        <div class="flex items-center gap-1 shrink-0 mt-0.5">
          <ConfidenceBadge confidence={item.confidence} />
          <SeverityBadge severity={item.severity} />
        </div>
      </div>
      <p class="text-xs text-gray-500 leading-relaxed">{item.explanation}</p>
    </div>
  );
}

function WarrantRow({ w }: { w: UnstatedWarrant }) {
  return (
    <div class="pl-4 border-l-2 border-indigo-200">
      <div class="flex items-start justify-between gap-2 mb-0.5">
        <p class="text-sm text-gray-700 leading-relaxed">{w.warrant}</p>
        <div class="flex items-center gap-1.5 shrink-0 mt-0.5">
          <ConfidenceBadge confidence={w.confidence} />
          <SeverityBadge severity={w.severity} />
        </div>
      </div>
      <p class="text-xs text-gray-400 leading-snug italic">{w.necessity}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function AuditResults({ result }: { result: AuditResult }) {
  const sortedFallacies    = sortByPriority(result.namedFallacies);
  const sortedLoadedLang   = sortByPriority(result.loadedLanguage);
  const sortedWarrants     = sortByPriority(result.toulmin.unstatedWarrants);
  const hasFindings        = sortedFallacies.length > 0 || sortedLoadedLang.length > 0;

  return (
    <div class="space-y-8 border-t border-gray-100 pt-8">

      {/* Central claim */}
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <p class="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-2">
          <LabelWithTooltip label="centralClaim" />
        </p>
        <p class="text-gray-900 text-base leading-relaxed">{result.centralClaim}</p>
      </div>

      {/* Toulmin breakdown */}
      <section>
        <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">
          <LabelWithTooltip label="toulmin" />
        </h2>

        <dl class="space-y-4">
          <ToulminRow label={<LabelWithTooltip label="toulminClaim" />}   text={result.toulmin.claim} />
          <ToulminRow label={<LabelWithTooltip label="toulminGrounds" />} text={result.toulmin.grounds} />
          {result.toulmin.statedWarrant && (
            <ToulminRow label={<LabelWithTooltip label="toulminWarrant" />} text={result.toulmin.statedWarrant} />
          )}

          {sortedWarrants.length > 0 && (
            <div>
              <dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                <LabelWithTooltip label="unstatedWarrants" />
              </dt>
              <dd class="space-y-3">
                {sortedWarrants.map((w, i) => (
                  <WarrantRow key={i} w={w} />
                ))}
              </dd>
            </div>
          )}

          <div class="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <dt class="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              <LabelWithTooltip label="weakestLink" />
            </dt>
            <dd class="text-sm text-amber-900 leading-relaxed">{result.toulmin.weakestLink}</dd>
          </div>
        </dl>
      </section>

      {/* Findings or empty state */}
      {!hasFindings ? (
        <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-5">
          <p class="text-sm text-emerald-700">
            No reasoning patterns or loaded language detected — the argument's structural integrity
            is the focus of the analysis above.
          </p>
        </div>
      ) : (
        <>
          {sortedFallacies.length > 0 && (
            <section>
              <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                <LabelWithTooltip label="namedFallacies" />
              </h2>
              <div class="space-y-3">
                {sortedFallacies.map((f, i) => (
                  <FallacyCard key={i} fallacy={f} />
                ))}
              </div>
            </section>
          )}

          {sortedLoadedLang.length > 0 && (
            <section>
              <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                <LabelWithTooltip label="loadedLanguage" />
              </h2>
              <div class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
                {sortedLoadedLang.map((item, i) => (
                  <LoadedLanguageRow key={i} item={item} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {result.notes && (
        <section>
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Notes
          </h2>
          <p class="text-sm text-gray-600 leading-relaxed">{result.notes}</p>
        </section>
      )}

    </div>
  );
}
