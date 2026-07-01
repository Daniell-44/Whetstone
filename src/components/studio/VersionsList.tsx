import { useState } from 'preact/hooks';

export interface VersionRow {
  id:             string;
  version_number: number;
  created_at:     number;
  hasAudit:       boolean;
  hasCounterarg:  boolean;
}

interface Props {
  docId:    string;
  versions: VersionRow[];
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function VersionsList({ docId, versions }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function handleCompare() {
    if (selected.length !== 2) return;
    const [a, b] = selected as [string, string];
    const vA = versions.find(v => v.id === a)!;
    const vB = versions.find(v => v.id === b)!;
    const [from, to] = vA.version_number < vB.version_number ? [a, b] : [b, a];
    window.location.href = `/creator/documents/${docId}/compare?from=${from}&to=${to}`;
  }

  const canCompare = selected.length === 2;

  return (
    <div class="space-y-2">
      {versions.length === 0 && (
        <p class="text-sm text-muted py-8 text-center">No versions saved yet.</p>
      )}

      {versions.map(v => {
        const isSelected = selected.includes(v.id);
        const isDisabled = !isSelected && selected.length === 2;
        return (
          <div
            key={v.id}
            class={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
              isSelected
                ? 'border-amber-300 bg-amber-50'
                : isDisabled
                ? 'border-hairline bg-paper opacity-50'
                : 'border-hairline bg-surface hover:border-amber-200'
            }`}
          >
            <label class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => toggle(v.id)}
                class="w-4 h-4 accent-amber-500 shrink-0"
              />
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink-strong">Version {v.version_number}</p>
                <p class="text-xs text-muted">{formatDate(v.created_at)}</p>
              </div>
            </label>

            <div class="flex gap-1.5 shrink-0">
              {v.hasAudit     && <span class="text-xs px-2 py-0.5 rounded-full bg-accent/5 text-accent">Audited</span>}
              {v.hasCounterarg && <span class="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">Counterargs</span>}
            </div>

            <a
              href={`/creator/documents/${docId}/versions/${v.id}`}
              class="shrink-0 text-xs text-muted hover:text-amber-600 transition-colors"
            >
              View →
            </a>
          </div>
        );
      })}

      <div class="sticky bottom-6 pt-4">
        <button
          type="button"
          onClick={handleCompare}
          disabled={!canCompare}
          class={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
            canCompare
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-hairline/40 text-muted cursor-not-allowed'
          }`}
        >
          {canCompare
            ? 'Compare selected versions'
            : `Select 2 versions to compare (${selected.length}/2 selected)`}
        </button>
      </div>
    </div>
  );
}
