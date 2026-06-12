import { useState, useEffect } from 'preact/hooks';

interface Take {
  id:          string;
  displayName: string | null;
  body:        string;
  kind:        'community' | 'editor';
  createdAt:   number;
}

const NAME_KEY = 'whetstone.take_name';

export default function TopicTakes({ slug, signedIn, returnTo }: { slug: string; signedIn: boolean; returnTo?: string }) {
  const signInReturn = returnTo ?? `/topic/${slug}`;
  const [takes, setTakes]   = useState<Take[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName]     = useState('');
  const [body, setBody]     = useState('');
  const [posting, setPosting] = useState(false);
  const [msg, setMsg]       = useState<string | null>(null);

  useEffect(() => {
    try { setName(localStorage.getItem(NAME_KEY) ?? ''); } catch { /* ignore */ }
    void load();
  }, []);

  async function load() {
    try {
      const res = await fetch(`/api/topic/${slug}/takes`);
      const data = await res.json() as { ok: boolean; takes?: Take[] };
      if (data.ok && data.takes) setTakes(data.takes);
    } finally { setLoaded(true); }
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (!body.trim() || !name.trim() || posting) return;
    setPosting(true); setMsg(null);
    try {
      const res = await fetch(`/api/topic/${slug}/takes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), displayName: name.trim() }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
        setBody('');
        setMsg('Posted.');
        await load();
      } else {
        setMsg(data.error ?? 'Could not post.');
      }
    } catch { setMsg('Network error.'); }
    setPosting(false);
  }

  async function report(id: string) {
    if (!confirm('Report this take for review? It will be hidden until checked.')) return;
    await fetch(`/api/topic/takes/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'report' }),
    });
    await load();
  }

  const editor    = takes.filter(t => t.kind === 'editor');
  const community = takes.filter(t => t.kind === 'community');

  return (
    <section class="mt-8 space-y-4">
      <h2 class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Takes</h2>

      <div class="grid md:grid-cols-2 gap-4">
        {/* Editor takes */}
        <div class="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-violet-600 mb-3">From the editor</p>
          {editor.length === 0 ? (
            <p class="text-xs text-gray-400">No editor note yet.</p>
          ) : (
            <ul class="space-y-3">
              {editor.map(t => (
                <li key={t.id} class="text-sm text-gray-700 leading-relaxed">
                  "{t.body}"
                  {t.displayName && <span class="block text-[11px] text-violet-500 mt-0.5">- {t.displayName}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Community takes */}
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">From readers</p>
          {!loaded ? (
            <p class="text-xs text-gray-400">Loading…</p>
          ) : community.length === 0 ? (
            <p class="text-xs text-gray-400">No takes yet. Be the first.</p>
          ) : (
            <ul class="space-y-3">
              {community.map(t => (
                <li key={t.id} class="group text-sm text-gray-700 leading-relaxed flex items-start gap-2">
                  <div class="flex-1">
                    "{t.body}"
                    {t.displayName && <span class="block text-[11px] text-gray-400 mt-0.5">- {t.displayName}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void report(t.id)}
                    class="opacity-0 group-hover:opacity-100 text-[10px] text-gray-300 hover:text-red-500 transition"
                    title="Report"
                  >
                    flag
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Post box */}
      {signedIn ? (
        <form onSubmit={submit} class="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <p class="text-xs font-medium text-gray-700">Add your take (one line)</p>
          <div class="flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onInput={e => setName((e.target as HTMLInputElement).value)}
              placeholder="Display name"
              maxLength={40}
              class="sm:w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <input
              value={body}
              onInput={e => setBody((e.target as HTMLInputElement).value)}
              placeholder="e.g. My kid got around it on day one."
              maxLength={240}
              class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={!body.trim() || !name.trim() || posting}
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
          {msg && <p class="text-xs text-gray-500">{msg}</p>}
        </form>
      ) : (
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
          <p class="text-sm text-gray-600">
            <a href={`/login?returnTo=${encodeURIComponent(signInReturn)}`} class="text-indigo-600 font-medium hover:text-indigo-800">Sign in</a>
            {' '}to add your take.
          </p>
        </div>
      )}
    </section>
  );
}
