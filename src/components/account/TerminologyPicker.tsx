import { useState } from 'preact/hooks';
import type { TerminologyPreference } from '../../lib/labels';

interface Props {
  initialPreference: TerminologyPreference;
}

const OPTIONS: { value: TerminologyPreference; label: string; description: string }[] = [
  {
    value:       'plain',
    label:       'Accessible',
    description: 'Friendly labels like "Hidden Assumptions" and "Framework Check".',
  },
  {
    value:       'formal',
    label:       'Formal',
    description: 'Precise philosophical terms like "Unstated Warrants" and "Philosophical Commitments".',
  },
];

export default function TerminologyPicker({ initialPreference }: Props) {
  const [preference, setPreference] = useState<TerminologyPreference>(initialPreference);
  const [status, setStatus]         = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleChange(value: TerminologyPreference) {
    if (value === preference) return;
    setPreference(value);
    setStatus('saving');
    try {
      const res = await fetch('/api/account/terminology', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ preference: value }),
      });
      if (!res.ok) throw new Error('Save failed');
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <div class="space-y-3">
      {OPTIONS.map(opt => (
        <label
          key={opt.value}
          class={`flex items-start gap-3 cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
            preference === opt.value
              ? 'border-amber-400 bg-amber-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <input
            type="radio"
            name="terminology"
            value={opt.value}
            checked={preference === opt.value}
            onChange={() => handleChange(opt.value)}
            class="mt-0.5 accent-amber-500"
          />
          <div>
            <p class="text-sm font-medium text-gray-900">{opt.label}</p>
            <p class="text-xs text-gray-500 mt-0.5">{opt.description}</p>
          </div>
        </label>
      ))}

      <div class="h-4 flex items-center">
        {status === 'saving' && (
          <p class="text-xs text-gray-400">Saving…</p>
        )}
        {status === 'saved' && (
          <p class="text-xs text-green-600">Saved</p>
        )}
        {status === 'error' && (
          <p class="text-xs text-red-500">Failed to save - try again</p>
        )}
      </div>
    </div>
  );
}
