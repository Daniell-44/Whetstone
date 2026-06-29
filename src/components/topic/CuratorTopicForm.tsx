import { useState } from 'preact/hooks';
import type { StoredTopic, StoredTopicSource, ArticleType } from '../../../functions/_lib/topic/types';

// Editable source row — adds a `text` field (the excerpt fed to the analyser;
// not stored on the published topic).
interface EditSource extends StoredTopicSource {
  text: string;
}

const SEED: { topic: Omit<StoredTopic, 'sources'>; sources: EditSource[] } = {
  topic: {
    slug:          'should-schools-ban-smartphones',
    question:      'Should schools ban smartphones during the school day?',
    framing:       '',
    category:      'education',
    takeaways:     { agree: '', realDisagreement: '', sharedAssumption: '', talkingPast: '' },
    editorNote:    null,
    publishedDate: new Date().toISOString().slice(0, 10),
    status:        'draft',
  },
  sources: [
    { id: 's1', outlet: 'BBC News', writer: null, date: '2 Jun 2026', type: 'news', leaning: 0, title: 'Schools trial phone bans amid mixed evidence', url: 'https://example.com/1', mainPoint: '', centralClaim: '', keyWarrant: '', steelman: '', text: '' },
    { id: 's2', outlet: 'The Guardian', writer: 'A. Writer', date: '28 May 2026', type: 'opinion', leaning: -40, title: 'Banning phones treats a symptom', url: 'https://example.com/2', mainPoint: '', centralClaim: '', keyWarrant: '', steelman: '', text: '' },
  ],
};

const input = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400';
const label = 'block text-xs font-medium text-gray-600 mb-1';

export default function CuratorTopicForm() {
  const [topic, setTopic]     = useState(SEED.topic);
  const [sources, setSources] = useState<EditSource[]>(SEED.sources);
  const [busy, setBusy]       = useState<'idle' | 'analysing' | 'saving'>('idle');
  const [msg, setMsg]         = useState<string | null>(null);

  function setSrc(i: number, patch: Partial<EditSource>) {
    setSources(sources.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function addSrc() {
    if (sources.length < 5) setSources([...sources, { id: `s${sources.length + 1}`, outlet: '', writer: null, date: '', type: 'opinion', leaning: 0, title: '', url: '', mainPoint: '', centralClaim: '', keyWarrant: '', steelman: '', text: '' }]);
  }
  function removeSrc(i: number) {
    if (sources.length > 2) setSources(sources.filter((_, idx) => idx !== i));
  }

  async function runAnalysis() {
    setBusy('analysing'); setMsg(null);
    try {
      const res = await fetch('/api/curator/topic-analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: sources.map(s => ({ id: s.id, outlet: s.outlet, text: s.text })) }),
      });
      const data = await res.json() as { ok: boolean; error?: string; result?: any };
      if (!data.ok || !data.result) { setMsg(data.error ?? 'Analysis failed'); setBusy('idle'); return; }
      const r = data.result;
      // Fill per-source structural fields + suggested leaning (override-able)
      setSources(sources.map(s => {
        const a = r.perSource.find((p: any) => p.id === s.id);
        return a ? { ...s, centralClaim: a.centralClaim, keyWarrant: a.keyWarrant, steelman: a.steelman, leaning: a.suggestedLeaning, mainPoint: s.mainPoint || a.centralClaim } : s;
      }));
      setTopic({ ...topic, framing: topic.framing || r.framing, takeaways: r.takeaways });
      setMsg('Analysis filled in. Review and adjust leaning + text, then save.');
    } catch { setMsg('Network error during analysis.'); }
    setBusy('idle');
  }

  async function save(status: 'draft' | 'published') {
    setBusy('saving'); setMsg(null);
    const payload: StoredTopic = {
      ...topic, status,
      sources: sources.map(({ text, ...keep }) => keep),  // strip the analysis-only text field
    };
    try {
      const res = await fetch('/api/curator/topic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json() as { ok: boolean; slug?: string; error?: string };
      setMsg(data.ok ? `Saved as ${status}: /topic/${data.slug}` : (data.error ?? 'Save failed'));
    } catch { setMsg('Network error during save.'); }
    setBusy('idle');
  }

  return (
    <div class="space-y-6">
      {/* Topic meta */}
      <div class="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div><label class={label}>Question</label><input class={input} value={topic.question} onInput={e => setTopic({ ...topic, question: (e.target as HTMLInputElement).value })} /></div>
        <div class="grid sm:grid-cols-3 gap-3">
          <div><label class={label}>Slug (kebab-case)</label><input class={input} value={topic.slug} onInput={e => setTopic({ ...topic, slug: (e.target as HTMLInputElement).value })} /></div>
          <div><label class={label}>Category</label><input class={input} value={topic.category ?? ''} onInput={e => setTopic({ ...topic, category: (e.target as HTMLInputElement).value || null })} /></div>
          <div><label class={label}>Published date</label><input class={input} value={topic.publishedDate} onInput={e => setTopic({ ...topic, publishedDate: (e.target as HTMLInputElement).value })} /></div>
        </div>
        <div><label class={label}>Framing (auto-filled by analysis; editable)</label><textarea class={input} rows={2} value={topic.framing} onInput={e => setTopic({ ...topic, framing: (e.target as HTMLTextAreaElement).value })} /></div>
      </div>

      {/* Sources */}
      <div class="space-y-4">
        {sources.map((s, i) => (
          <div key={i} class="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-500">Source {i + 1}</span>
              {sources.length > 2 && <button type="button" onClick={() => removeSrc(i)} class="text-xs text-gray-400 hover:text-red-600">Remove</button>}
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
              <div><label class={label}>Outlet</label><input class={input} value={s.outlet} onInput={e => setSrc(i, { outlet: (e.target as HTMLInputElement).value })} /></div>
              <div><label class={label}>Writer (optional)</label><input class={input} value={s.writer ?? ''} onInput={e => setSrc(i, { writer: (e.target as HTMLInputElement).value || null })} /></div>
              <div><label class={label}>Date</label><input class={input} value={s.date} onInput={e => setSrc(i, { date: (e.target as HTMLInputElement).value })} /></div>
              <div><label class={label}>Type</label>
                <select class={input} value={s.type} onChange={e => setSrc(i, { type: (e.target as HTMLSelectElement).value as ArticleType })}>
                  <option value="news">News</option><option value="opinion">Opinion</option><option value="analysis">Analysis</option>
                </select>
              </div>
              <div class="sm:col-span-2"><label class={label}>URL</label><input class={input} value={s.url} onInput={e => setSrc(i, { url: (e.target as HTMLInputElement).value })} /></div>
              <div class="sm:col-span-2"><label class={label}>Title</label><input class={input} value={s.title} onInput={e => setSrc(i, { title: (e.target as HTMLInputElement).value })} /></div>
            </div>
            <div><label class={label}>Article text / excerpt (for analysis, not published)</label><textarea class={input} rows={4} value={s.text} placeholder="Paste the article body or a substantial excerpt…" onInput={e => setSrc(i, { text: (e.target as HTMLTextAreaElement).value })} /></div>

            {/* AI-filled fields, editable */}
            <div class="grid sm:grid-cols-2 gap-3 border-t border-gray-100 pt-3">
              <div>
                <label class={label}>Leaning (-100 left … +100 right): AI suggests, you override</label>
                <input type="number" min={-100} max={100} class={input} value={s.leaning} onInput={e => setSrc(i, { leaning: parseInt((e.target as HTMLInputElement).value || '0', 10) })} />
              </div>
              <div><label class={label}>Main point (shown collapsed)</label><input class={input} value={s.mainPoint} onInput={e => setSrc(i, { mainPoint: (e.target as HTMLInputElement).value })} /></div>
              <div class="sm:col-span-2"><label class={label}>Central claim</label><textarea class={input} rows={2} value={s.centralClaim} onInput={e => setSrc(i, { centralClaim: (e.target as HTMLTextAreaElement).value })} /></div>
              <div class="sm:col-span-2"><label class={label}>Load-bearing assumption</label><textarea class={input} rows={2} value={s.keyWarrant} onInput={e => setSrc(i, { keyWarrant: (e.target as HTMLTextAreaElement).value })} /></div>
              <div class="sm:col-span-2"><label class={label}>Steelman</label><textarea class={input} rows={2} value={s.steelman} onInput={e => setSrc(i, { steelman: (e.target as HTMLTextAreaElement).value })} /></div>
            </div>
          </div>
        ))}
        {sources.length < 5 && <button type="button" onClick={addSrc} class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add source</button>}
      </div>

      {/* Takeaways */}
      <div class="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-indigo-600">Takeaways (auto-filled; editable)</p>
        {(['agree', 'realDisagreement', 'sharedAssumption', 'talkingPast'] as const).map(k => (
          <div key={k}><label class={label}>{k}</label><textarea class={input} rows={2} value={topic.takeaways[k]} onInput={e => setTopic({ ...topic, takeaways: { ...topic.takeaways, [k]: (e.target as HTMLTextAreaElement).value } })} /></div>
        ))}
      </div>

      <div><label class={label}>Editor's note (optional)</label><textarea class={input} rows={2} value={topic.editorNote ?? ''} onInput={e => setTopic({ ...topic, editorNote: (e.target as HTMLTextAreaElement).value || null })} /></div>

      {/* Actions */}
      <div class="flex flex-wrap items-center gap-3 sticky bottom-0 bg-white/90 backdrop-blur py-3 border-t border-gray-200">
        <button type="button" onClick={runAnalysis} disabled={busy !== 'idle'} class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy === 'analysing' ? 'Analysing…' : 'Run analysis (fills fields)'}
        </button>
        <button type="button" onClick={() => save('draft')} disabled={busy !== 'idle'} class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">Save draft</button>
        <button type="button" onClick={() => save('published')} disabled={busy !== 'idle'} class="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Publish</button>
        {msg && <span class="text-xs text-gray-600">{msg}</span>}
      </div>
    </div>
  );
}
