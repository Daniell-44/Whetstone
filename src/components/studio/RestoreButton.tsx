import { useState } from 'preact/hooks';

interface Props {
  docId:     string;
  versionId: string;
}

export default function RestoreButton({ docId, versionId }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function handleRestore() {
    setState('loading');
    try {
      const res  = await fetch(`/api/documents/${docId}/versions/${versionId}/restore`, { method: 'POST' });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        window.location.href = `/audit?mode=create&doc=${docId}`;
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'error') {
    return (
      <p class="text-sm text-accent">
        Restore failed.{' '}
        <button
          type="button"
          onClick={() => setState('idle')}
          class="underline hover:text-accent/80"
        >
          Try again
        </button>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={state === 'loading'}
      class={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
        state === 'loading'
          ? 'bg-hairline/40 text-muted cursor-not-allowed'
          : 'bg-accent-support text-white hover:bg-accent'
      }`}
    >
      {state === 'loading' ? 'Restoring…' : 'Restore this version'}
    </button>
  );
}
