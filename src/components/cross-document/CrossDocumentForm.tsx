import { useState, useEffect } from 'preact/hooks';
import type { CrossDocumentResult } from '../../../functions/_lib/cross-document/types';
import type { Document, DocumentVersion } from '../../../functions/_lib/documents/types';
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
  | { status: 'done'; result: CrossDocumentResult; savedDocumentId?: string }
  // A previously persisted run reopened via ?doc=<id>: read-only, no re-run.
  | { status: 'stored'; result: CrossDocumentResult; savedAt: number; title: string }
  | { status: 'error'; message: string };

const MIN_DOCS = 2;
const MAX_DOCS = 5;

function emptyDoc(): DocEntry {
  return { kind: 'text', text: '', label: '' };
}

export default function CrossDocumentForm() {
  const [docs, setDocs]   = useState<DocEntry[]>([emptyDoc(), emptyDoc()]);
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });

  // Reopen a persisted run: /creator/studio/cross-document?doc=<id> loads the
  // stored result and renders it read-only, without consuming a run.
  useEffect(() => {
    const docId = new URLSearchParams(window.location.search).get('doc');
    if (!docId) return;
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`/api/documents/${encodeURIComponent(docId)}`);
        const data = await res.json() as
          | { ok: true; document: Document; latestVersion: DocumentVersion | null }
          | { ok: false };
        if (cancelled) return;
        if (!data.ok || data.document.kind !== 'cross-doc' || !data.latestVersion?.result_json) {
          setPhase({ status: 'error', message: 'Could not load that stored cross-document analysis.' });
          return;
        }
        setPhase({
          status:  'stored',
          result:  JSON.parse(data.latestVersion.result_json) as CrossDocumentResult,
          savedAt: data.latestVersion.created_at,
          title:   data.document.title,
        });
      } catch {
        if (!cancelled) setPhase({ status: 'error', message: 'Could not load that stored cross-document analysis.' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
        | { ok: true;  result: CrossDocumentResult; savedDocumentId?: string }
        | { ok: false; error: { code: string; message: string } };

      if (data.ok) {
        setPhase({ status: 'done', result: data.result, savedDocumentId: data.savedDocumentId });
        track('cross_document_completed', {
          latency_ms: Math.round(performance.now() - startedAt),
          finding_count: data.result.synthesis?.findings.length ?? 0,
        });
      } else {
        setPhase({ status: 'error', message: data.error.message });
      }
    } catch {
      setPhase({ status: 'error', message: 'Network error - check your connection.' });
    }
  }

  // Read-only view of a persisted run: no input form, no re-run needed.
  if (phase.status === 'stored') {
    return (
      <div class="space-y-6">
        <div class="rounded-xl border border-hairline bg-surface px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Stored result</span>
          <span class="text-xs text-muted">
            {phase.title} · saved {new Date(phase.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <a href="/audit?mode=question&ask=documents" class="ml-auto text-xs text-accent-support hover:underline">
            Run a new analysis →
          </a>
        </div>
        <CrossDocumentDisplay result={phase.result} />
      </div>
    );
  }

  return (
    <div class="space-y-6">
      <div class="space-y-4">
        {docs.map((doc, i) => (
          <div key={i} class="rounded-xl border border-hairline bg-surface p-4 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-muted">Document {i + 1}</span>
                <div class="flex gap-0.5 p-0.5 bg-hairline/40 rounded-md">
                  {(['text', 'url'] as DocKind[]).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => updateDoc(i, { kind: k, text: '' })}
                      class={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        doc.kind === k ? 'bg-surface text-ink-strong shadow-sm' : 'text-muted hover:text-ink'
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
                  class="text-xs text-muted hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            <input
              type="text"
              value={doc.label}
              onInput={e => updateDoc(i, { label: (e.target as HTMLInputElement).value })}
              placeholder="Label (optional) - e.g. author, date, title"
              maxLength={120}
              class="w-full rounded-md border border-hairline px-3 py-1.5 text-xs text-ink placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />

            {doc.kind === 'text' ? (
              <textarea
                value={doc.text}
                onInput={e => updateDoc(i, { text: (e.target as HTMLTextAreaElement).value })}
                placeholder="Paste this document's text (50-10,000 characters)…"
                rows={5}
                class="w-full rounded-md border border-hairline px-3 py-2 text-sm text-ink placeholder-muted leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-accent"
              />
            ) : (
              <input
                type="url"
                value={doc.text}
                onInput={e => updateDoc(i, { text: (e.target as HTMLInputElement).value })}
                placeholder="https://example.com/article"
                class="w-full rounded-md border border-hairline px-3 py-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
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
            class="text-sm text-accent-support hover:text-accent font-medium"
          >
            + Add document
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          class={`ml-auto py-2.5 px-6 rounded-xl text-sm font-semibold transition-colors ${
            canSubmit ? 'bg-accent-support text-white hover:bg-accent-support/90' : 'bg-hairline/40 text-muted cursor-not-allowed'
          }`}
        >
          {phase.status === 'loading' ? 'Analysing…' : `Analyse ${filledDocs.length || MIN_DOCS} documents`}
        </button>
      </div>

      {phase.status === 'loading' && (
        <div class="rounded-xl bg-accent/5 border border-accent/20 p-5 text-center">
          <p class="text-sm text-accent font-medium">Auditing each document, then comparing across them…</p>
          <p class="text-xs text-accent/70 mt-1">This takes 60-120 seconds - each document is fully audited before the cross-document pass.</p>
        </div>
      )}

      {phase.status === 'error' && (
        <div class="rounded-xl bg-red-50 border border-red-200 p-4">
          <p class="text-sm text-red-700">{phase.message}</p>
        </div>
      )}

      {phase.status === 'done' && (
        <div class="border-t border-hairline pt-6 space-y-4">
          <p class="text-xs text-muted">
            {phase.savedDocumentId ? (
              <>
                Saved to <a href="/creator/documents" class="text-accent-support hover:underline">My Documents</a>, so you can reopen this result later.
              </>
            ) : (
              <>This result is not saved. Sign in before running to keep results in My Documents.</>
            )}
          </p>
          <CrossDocumentDisplay result={phase.result} />
        </div>
      )}
    </div>
  );
}
