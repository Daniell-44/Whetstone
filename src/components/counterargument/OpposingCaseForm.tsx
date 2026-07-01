import { useState, useEffect } from 'preact/hooks';
import type { CounterargumentResult } from '../../lib/counterargument';
import CounterargumentResultDisplay from '../studio/CounterargumentResultDisplay';

const MIN_CHARS = 50;
const MAX_CHARS = 10_000;

const SAMPLE = `Every business that has succeeded has done so by relentless focus on the customer. The companies that fail are the ones that lose sight of what their customers actually want. Steve Jobs, Jeff Bezos, and every great entrepreneur in history has repeated this point. The lesson is clear: if you put the customer first, you will succeed. If you don't, you won't.`;

type Phase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: CounterargumentResult }
  | { status: 'error'; message: string };

export default function OpposingCaseForm() {
  const [text, setText]   = useState('');
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });

  const charCount = text.length;
  const canSubmit = charCount >= MIN_CHARS && charCount <= MAX_CHARS && phase.status !== 'loading';

  // Ctrl/Cmd + Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
        e.preventDefault();
        void handleSubmit();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [canSubmit, text]);

  async function handleSubmit() {
    setPhase({ status: 'loading' });
    try {
      const res = await fetch('/api/counterargument-public', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });
      const data = await res.json() as
        | { ok: true; result: CounterargumentResult }
        | { ok: false; error: { code: string; message: string } };

      if (data.ok) {
        setPhase({ status: 'done', result: data.result });
      } else {
        setPhase({ status: 'error', message: data.error.message });
      }
    } catch {
      setPhase({ status: 'error', message: 'Network error - check your connection and try again.' });
    }
  }

  return (
    <div class="space-y-6">

      {/* Input area */}
      <div class="rounded-xl border border-violet-200 bg-surface p-5 sm:p-6 space-y-3">
        <textarea
          value={text}
          onInput={e => setText((e.target as HTMLTextAreaElement).value)}
          placeholder="Paste an argument you believe in - or one you want to test against the strongest opposing case…"
          rows={9}
          disabled={phase.status === 'loading'}
          class="w-full rounded-lg border border-hairline bg-paper px-4 py-3 text-sm text-ink placeholder-muted leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-colors disabled:opacity-60"
        />

        <div class="flex justify-between text-xs">
          <span class={
            charCount > 0 && charCount < MIN_CHARS ? 'text-amber-600'
            : charCount > MAX_CHARS               ? 'text-red-500'
            :                                       'text-muted'
          }>
            {charCount > 0 && charCount < MIN_CHARS
              ? `${MIN_CHARS - charCount} more character${MIN_CHARS - charCount === 1 ? '' : 's'} needed`
              : charCount > MAX_CHARS
                ? 'Too long - trim to 10,000 characters'
                : ''}
          </span>
          <span class={charCount > MAX_CHARS ? 'text-red-500' : 'text-muted'}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>

        <div class="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            class={`flex-1 py-2.5 px-6 rounded-lg text-sm font-semibold transition-colors ${
              canSubmit
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-hairline/40 text-muted cursor-not-allowed'
            }`}
          >
            {phase.status === 'loading' ? 'Finding the strongest case against…' : 'Find the strongest opposing case'}
          </button>
          {!text.trim() && (
            <button
              type="button"
              onClick={() => setText(SAMPLE)}
              class="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-medium text-muted border border-hairline hover:bg-paper hover:text-ink transition-colors"
            >
              Try an example
            </button>
          )}
        </div>
        {canSubmit && (
          <p class="text-xs text-muted text-center">⌘/Ctrl + Enter</p>
        )}
      </div>

      {/* Results */}
      {phase.status === 'loading' && (
        <div class="rounded-xl bg-violet-50 border border-violet-100 p-5 text-center">
          <p class="text-sm text-violet-700 font-medium">Finding the strongest opposing positions…</p>
          <p class="text-xs text-violet-400 mt-1">~30 seconds. The engine is steelmanning every objection a thoughtful opponent would deploy.</p>
        </div>
      )}

      {phase.status === 'error' && (
        <div class="rounded-xl bg-red-50 border border-red-200 p-4">
          <p class="text-sm text-red-700">{phase.message}</p>
        </div>
      )}

      {phase.status === 'done' && (
        <div class="rounded-xl border border-violet-200 bg-surface p-5 sm:p-6">
          <CounterargumentResultDisplay result={phase.result} />
        </div>
      )}

    </div>
  );
}
