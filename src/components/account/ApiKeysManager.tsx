import { useState, useEffect, useCallback } from 'preact/hooks';

interface ApiKey {
  id:          string;
  name:        string;
  keyPrefix:   string;
  createdAt:   number;
  lastUsedAt:  number | null;
  revokedAt:   number | null;
}

function fmt(ms: number | null): string {
  if (!ms) return 'Never';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ApiKeysManager() {
  const [keys, setKeys]           = useState<ApiKey[]>([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [revealed, setRevealed]   = useState<string | null>(null); // one-time plaintext
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/keys');
      const data = await res.json() as { ok: boolean; keys?: ApiKey[] };
      if (data.ok && data.keys) setKeys(data.keys);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res  = await fetch('/api/keys', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json() as { ok: boolean; key?: { id: string; name: string; plaintext: string; keyPrefix: string; createdAt: number }; error?: string };
      if (!data.ok) { setError(data.error ?? 'Failed to create key'); return; }
      setRevealed(data.key!.plaintext);
      setNewName('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string, keyName: string) {
    if (!confirm(`Revoke "${keyName}"? Any integrations using it will stop working immediately.`)) return;
    await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
    await load();
  }

  const active = keys.filter((key) => !key.revokedAt);

  return (
    <div className="space-y-4">
      {/* One-time reveal banner */}
      {revealed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 mb-2">Copy your key now - it won't be shown again.</p>
          <code className="block text-xs font-mono text-amber-900 break-all bg-amber-100 rounded px-3 py-2 select-all">
            {revealed}
          </code>
          <button
            onClick={() => { void navigator.clipboard.writeText(revealed); }}
            className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
          >
            Copy to clipboard
          </button>
          <button
            onClick={() => setRevealed(null)}
            className="ml-4 text-xs text-amber-500 hover:text-amber-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Existing keys */}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted">No API keys yet.</p>
      ) : (
        <div className="divide-y divide-hairline rounded-lg border border-hairline bg-surface">
          {active.map((k) => (
            <div key={k.id} className="px-4 py-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink-strong">{k.name}</p>
                <p className="text-xs font-mono text-muted mt-0.5">{k.keyPrefix}…</p>
                <p className="text-xs text-muted mt-1">
                  Created {fmt(k.createdAt)} · Last used {fmt(k.lastUsedAt)}
                </p>
              </div>
              <button
                onClick={() => void handleRevoke(k.id, k.name)}
                className="shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={(e) => void handleCreate(e)} className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
          placeholder={'Key name (e.g. "CMS integration")'}
          maxLength={80}
          className="flex-1 rounded-md border border-hairline px-3 py-2 text-sm text-ink-strong placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <p className="text-xs text-muted">
        Use your key as <code className="font-mono">Authorization: Bearer &lt;key&gt;</code> on POST requests to{' '}
        <a href="/developer" className="underline hover:text-ink">/api/audit</a>.
        Maximum 10 active keys per account.
      </p>
    </div>
  );
}
