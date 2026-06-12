import { useState, useEffect } from 'preact/hooks';

interface AdminTake {
  id:           string;
  topic_slug:   string;
  user_id:      string | null;
  display_name: string | null;
  body:         string;
  kind:         'community' | 'editor';
  status:       'pending' | 'approved' | 'rejected';
  created_at:   number;
}

type Tab = 'pending' | 'approved' | 'rejected';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'pending',  label: 'Pending',  hint: 'Reported or queued — hidden from readers until you act' },
  { id: 'approved', label: 'Approved', hint: 'Live and visible. Remove anything that should not be.' },
  { id: 'rejected', label: 'Rejected', hint: 'Hidden permanently. Restore if reported in error.' },
];

export default function ModerationQueue() {
  const [tab, setTab]     = useState<Tab>('pending');
  const [takes, setTakes] = useState<AdminTake[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]   = useState<string | null>(null);

  useEffect(() => { void load(tab); }, [tab]);

  async function load(status: Tab) {
    setLoading(true);
    try {
      const res = await fetch(`/api/curator/takes?status=${status}`);
      const data = await res.json() as { ok: boolean; takes?: AdminTake[] };
      setTakes(data.ok && data.takes ? data.takes : []);
    } finally { setLoading(false); }
  }

  async function act(id: string, action: 'approve' | 'reject' | 'delete') {
    if (action === 'delete' && !confirm('Permanently delete this take?')) return;
    setBusy(id);
    try {
      await fetch(`/api/topic/takes/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setTakes(takes.filter(t => t.id !== id)); // drop from current view
    } finally { setBusy(null); }
  }

  const activeHint = TABS.find(t => t.id === tab)?.hint ?? '';

  return (
    <div class="space-y-4">
      <div class="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            class={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p class="text-xs text-gray-400">{activeHint}</p>

      {loading ? (
        <p class="text-sm text-gray-400">Loading…</p>
      ) : takes.length === 0 ? (
        <p class="text-sm text-gray-400">Nothing here.</p>
      ) : (
        <ul class="space-y-3">
          {takes.map(t => (
            <li key={t.id} class="rounded-lg border border-gray-200 bg-white p-4">
              <div class="flex items-center gap-2 mb-1.5 text-[11px] text-gray-400 flex-wrap">
                <a href={`/topic/${t.topic_slug}`} class="text-indigo-500 hover:text-indigo-700 underline">{t.topic_slug}</a>
                <span>· {t.kind}</span>
                <span>· {t.display_name ?? 'anon'}</span>
                <span>· {new Date(t.created_at).toLocaleDateString('en-GB')}</span>
              </div>
              <p class="text-sm text-gray-800 leading-relaxed mb-3">"{t.body}"</p>
              <div class="flex items-center gap-2">
                {tab !== 'approved' && (
                  <button type="button" onClick={() => void act(t.id, 'approve')} disabled={busy === t.id}
                    class="text-xs rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                )}
                {tab !== 'rejected' && (
                  <button type="button" onClick={() => void act(t.id, 'reject')} disabled={busy === t.id}
                    class="text-xs rounded-md border border-gray-300 px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50">Hide</button>
                )}
                <button type="button" onClick={() => void act(t.id, 'delete')} disabled={busy === t.id}
                  class="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
