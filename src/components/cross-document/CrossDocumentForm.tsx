import { useState } from 'preact/hooks';
import type { CrossDocumentResult } from '../../../functions/_lib/cross-document/types';
import CrossDocumentDisplay from './CrossDocumentDisplay';
import { track } from '../../lib/analytics/track';

type DocKind = 'text' | 'url';

interface DocEntry {
  kind:  DocKind;
  text:  string;  // text body OR url, depending on kind
  label: string;
}

type Phase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: CrossDocumentResult }
  | { status: 'error'; message: string };

const MIN_DOCS = 2;
const MAX_DOCS = 5;

function emptyDoc(): DocEntry {
  return { kind: 'text', text: '', label: '' };
}

export default function CrossDocumentForm() {
  const [docs, setDocs]   = useState<DocEntry[]>([emptyDoc(), emptyDoc()]);
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });

  function updateDoc(i: number, patch: Partial<DocEntry>) {
    setDocs(docs.map((d, idx) => idx === i ? { ...d, ...patch } : d));
  }
  function addDoc() {
    if (docs.length < MAX_DOCS) setDocs([...docs, emptyDoc()]);
  }
  function removeDoc(i: number) {
    if (docs.length > MIN_DOCS) setDocs(docs.filter((_, idx) => idx !== i));
  }

  const filledDocs = docs.filter(d =>
    d.kind === 'url' ? d.text.trim().startsWith('http') : d.text.trim().length >= 50,
  );
  const canSubmit = phase.status !== 'loading' && filledDocs.length >= MIN_DOCS;

  async function handleSubmit() {
    if (!canSubmit) return;
    setPhase({ status: 'loading' });
    const startedAt = performance.now();
    track('cross_document_started', { doc_count: filledDocs.length });

    const payload = {
      documents: filledDocs.map(d =>
        d.kind === 'url'
          ? { kind: 'url' as const,  url:  d.text.trim(), label: d.label.trim() || undefined }
          : { kind: 'text' as const, text: d.text.trim(), label: d.label.trim() || undefined },
      ),
    };

    try {
      const res = await fetch('/api/cross-document', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json() as
        | { ok: true;  result: CrossDocumentResult }
        | { ok: false; error: { code: string; message: string } };

      if (data.ok) {
        setPhase({ status: 'done', result: data.result });
        track('cross_document_completed', {
          latency_ms: Math.round(performance.now() - startedAt),
          finding_count: data.result.synthesis?.findings.length ?? 0,
        });
      } else {
        setPhase({ status: 'error', message: data.error.message });
      }
    } catch {
      setPhase({ status: 'error', message: 'Network error — check your connection.' });
    }
  }

  return (
    <div class="space-y-6">
      <div class="space-y-4">
        {docs.map((doc, i) => (
          <div key={i} class="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-gray-500">Document {i + 1}</span>
                <div class="flex gap-0.5 p-0.5 bg-gray-100 rounded-md">
                  {(['text', 'url'] as DocKind[]).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => updateDoc(i, { kind: k, text: '' })}
                      class={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                        doc.kind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {k === 'text' ? 'Paste' : 'URL'}
                    </button>
                  ))}
                </div>
              </div>
              {docs.length > MIN_DOCS && (
                <button
                  type="button"
                  onClick={() => removeDoc(i)}
                  class="text-xs text-gray-400 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            <input
              type="text"
              value={doc.label}
              onInput={e => updateDoc(i, { label: (e.target as HTMLInputElement).value })}
              placeholder="Label (optional) — e.g. author, date, title"
              maxLength={120}
              class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />

            {doc.kind === 'text' ? (
              <textarea
                value={doc.text}
                onInput={e => updateDoc(i, { text: (e.target as HTMLTextAreaElement).value })}
                placeholder="Paste this document's text (50–10,000 characters)…"
                rows={5}
                class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            ) : (
              <input
                type="url"
                value={doc.text}
                onInput={e => updateDoc(i, { text: (e.target as HTMLInputElement).value })}
                placeholder="https://example.com/article"
                class="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            )}
          </div>
        ))}
      </div>

      <div class="flex items-center gap-3">
        {docs.length < MAX_DOCS && (
          <button
            type="button"
            onClick={addDoc}
            class="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Add document
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          class={`ml-auto py-2.5 px-6 rounded-xl text-sm font-semibold transition-colors ${
            canSubmit ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {phase.status === 'loading' ? 'Analysing…' : `Analyse ${filledDocs.length || MIN_DOCS} documents`}
        </button>
      </div>

      {phase.status === 'loading' && (
        <div class="rounded-xl bg-indigo-50 border border-indigo-100 p-5 text-center">
          <p class="text-sm text-indigo-700 font-medium">Auditing each document, then comparing across them…</p>
          <p class="text-xs text-indigo-400 mt-1">This takes 60–120 seconds — each document is fully audited before the cross-document pass.</p>
        </div>
      )}

      {phase.status === 'error' && (
        <div class="rounded-xl bg-red-50 border border-red-200 p-4">
          <p class="text-sm text-red-700">{phase.message}</p>
        </div>
      )}

      {phase.status === 'done' && (
        <div class="border-t border-gray-200 pt-6">
          <CrossDocumentDisplay result={phase.result} />
        </div>
      )}
    </div>
  );
}
