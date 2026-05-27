import { useState } from 'preact/hooks';

type FormState = 'idle' | 'loading' | 'sent' | 'error';

export default function LoginForm() {
  const [email, setEmail]   = useState('');
  const [state, setState]   = useState<FormState>('idle');
  const [errMsg, setErrMsg] = useState('');

  const invalid = !email.trim().includes('@');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (invalid || state === 'loading') return;

    setState('loading');
    try {
      const res  = await fetch('/api/auth/request-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        setState('sent');
      } else {
        setErrMsg(data.error ?? 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setErrMsg('Network error — check your connection.');
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div class="rounded-lg border border-indigo-100 bg-indigo-50 px-6 py-8 text-center">
        <p class="text-lg font-medium text-indigo-900">Check your email</p>
        <p class="mt-2 text-sm text-indigo-700">
          We sent a sign-in link to <strong>{email}</strong>.
          It expires in 15 minutes.
        </p>
        <button
          class="mt-5 text-sm text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          onClick={() => { setState('idle'); setEmail(''); }}
        >
          Try a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autocomplete="email"
          required
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          placeholder="you@example.com"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm
                 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                 disabled:bg-gray-50"
          disabled={state === 'loading'}
        />
      </div>

      {state === 'error' && (
        <p class="text-sm text-red-600">{errMsg}</p>
      )}

      <button
        type="submit"
        disabled={invalid || state === 'loading'}
        class="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white
               hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors"
      >
        {state === 'loading' ? 'Sending…' : 'Send sign-in link'}
      </button>

      <p class="text-xs text-gray-400 text-center">
        No password needed. We'll email you a one-time link.
      </p>
    </form>
  );
}
