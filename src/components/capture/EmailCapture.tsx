import { useState } from 'preact/hooks';

// Email capture form. Fully self-contained on our D1 list: no provider, no
// third-party embed. Duplicate submissions come back ok from the server
// (INSERT OR IGNORE), so the success state never reveals list membership.

type FormState = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  source:   'briefing' | 'extension' | 'footer';
  heading:  string;
  sub?:     string;
  /** Single-row variant for tight spots (the site footer). */
  compact?: boolean;
}

export default function EmailCapture({ source, heading, sub, compact = false }: Props) {
  const [email, setEmail]   = useState('');
  const [state, setState]   = useState<FormState>('idle');
  const [errMsg, setErrMsg] = useState('');

  const invalid = !email.trim().includes('@');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (invalid || state === 'loading') return;
    setState('loading');
    setErrMsg('');
    try {
      const res = await fetch('/api/email-capture', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), source }),
      });
      const data = await res.json() as { ok: boolean; error?: { message?: string } };
      if (data.ok) {
        setState('done');
      } else {
        setErrMsg(data.error?.message ?? 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setErrMsg('Network error. Check your connection and try again.');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div class={compact ? 'py-2' : ''}>
        <p class="text-[15px] text-ink">You are on the list.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={submit} class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span class="font-mono text-[13px] uppercase tracking-[0.08em] text-muted">{heading}</span>
        <input
          type="email"
          autocomplete="email"
          required
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          placeholder="you@example.com"
          aria-label="Email address"
          class="flex-1 min-w-[12rem] rounded-md border border-hairline bg-surface px-3 py-1.5 text-[13px]
                 focus:border-accent-support focus:outline-none focus:ring-1 focus:ring-accent-support
                 disabled:bg-paper"
          disabled={state === 'loading'}
        />
        <button
          type="submit"
          disabled={invalid || state === 'loading'}
          class="rounded-md bg-accent-support px-3 py-1.5 text-[13px] font-medium text-white
                 hover:bg-accent-support/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state === 'loading' ? 'Sending…' : 'Notify me'}
        </button>
        {/* The compact form runs sitewide, so it carries its own one-line
           disclosure; the full variant's longer line lives below the form. */}
        <p class="w-full text-[13px] text-muted">
          When one publishes. Stored for <a href="/privacy" class="underline hover:text-ink transition-colors">updates only</a>, no tracking.
        </p>
        {state === 'error' && <p class="w-full text-[13px] text-accent">{errMsg}</p>}
      </form>
    );
  }

  return (
    <div>
      <p class="font-mono text-[13px] uppercase tracking-[0.08em] text-muted mb-1.5">{heading}</p>
      {sub && <p class="text-[15px] text-muted mb-3">{sub}</p>}
      <form onSubmit={submit} class="flex flex-col sm:flex-row gap-2 max-w-md">
        <input
          type="email"
          autocomplete="email"
          required
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          placeholder="you@example.com"
          aria-label="Email address"
          class="flex-1 rounded-md border border-hairline bg-surface px-3 py-2 text-[15px]
                 focus:border-accent-support focus:outline-none focus:ring-1 focus:ring-accent-support
                 disabled:bg-paper"
          disabled={state === 'loading'}
        />
        <button
          type="submit"
          disabled={invalid || state === 'loading'}
          class="shrink-0 rounded-md bg-accent-support px-4 py-2 text-[15px] font-medium text-white
                 hover:bg-accent-support/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state === 'loading' ? 'Sending…' : 'Notify me'}
        </button>
      </form>
      {state === 'error' && <p class="text-[13px] text-accent mt-2">{errMsg}</p>}
      <p class="text-[13px] text-muted mt-2">
        {source === 'extension'
          ? 'Your address is stored so we can tell you when the extension ships. Nothing else, no tracking.'
          : 'Your address is stored for briefing updates only. Nothing else, no tracking.'}
      </p>
    </div>
  );
}
