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
        window.location.href = `/creator/studio?doc=${docId}`;
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'error') {
    return (
      <p class="text-sm text-red-600">
        Restore failed.{' '}
        <button
          type="button"
          onClick={() => setState('idle')}
          class="underline hover:text-red-700"
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
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-amber-500 text-white hover:bg-amber-600'
      }`}
    >
      {state === 'loading' ? 'Restoring…' : 'Restore this version'}
    </button>
  );
}
