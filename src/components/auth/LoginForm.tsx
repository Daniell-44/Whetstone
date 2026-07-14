import { useState, useEffect, useRef } from 'preact/hooks';

type FormState = 'idle' | 'loading' | 'sent' | 'error' | 'verifying';

const CODE_TTL_MS = 15 * 60 * 1000; // matches MAGIC_LINK_TTL_MS in handlers.ts

interface Props {
  /** Path to redirect to after sign-in completes. Defaults to /account. */
  returnTo?: string;
}

export default function LoginForm({ returnTo }: Props) {
  const [email, setEmail]   = useState('');
  const [state, setState]   = useState<FormState>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [code, setCode]     = useState('');
  const [codeError, setCodeError] = useState('');
  const [effectiveReturnTo, setEffectiveReturnTo] = useState<string | undefined>(returnTo);

  // Countdown - shows mm:ss until the code expires.
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow]       = useState<number>(Date.now());
  const tickRef = useRef<number | null>(null);

  // Pick up ?returnTo= from URL if not passed as prop.
  useEffect(() => {
    if (returnTo) return;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('returnTo');
      if (fromUrl) setEffectiveReturnTo(fromUrl);
    } catch { /* ignore */ }
  }, [returnTo]);

  // Tick every second while in `sent` state so the timer updates.
  useEffect(() => {
    if (state !== 'sent') {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    setNow(Date.now());
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [state]);

  const invalid = !email.trim().includes('@');
  const msRemaining = sentAt ? Math.max(0, sentAt + CODE_TTL_MS - now) : 0;
  const expired = sentAt !== null && msRemaining <= 0;
  const mins = Math.floor(msRemaining / 60_000);
  const secs = Math.floor((msRemaining % 60_000) / 1000);

  async function sendCode() {
    setState('loading');
    setErrMsg('');
    setCode('');
    setCodeError('');
    try {
      const res = await fetch('/api/auth/request-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:    email.trim().toLowerCase(),
          returnTo: effectiveReturnTo,
        }),
      });
      const data = await res.json() as {
        ok: boolean;
        error?: string;
        __debug?: { code: string; link: string };
      };
      if (data.ok) {
        // Debug-mode pre-fill (server only includes this when AUTH_DEBUG_LOG_CODES=1).
        if (data.__debug?.code) setCode(data.__debug.code);
        setSentAt(Date.now());
        setState('sent');
      } else {
        setErrMsg(data.error ?? 'Something went wrong. Please try again.');
        setState('error');
      }
    } catch {
      setErrMsg('Network error - check your connection.');
      setState('error');
    }
  }

  async function submitEmail(e: SubmitEvent) {
    e.preventDefault();
    if (invalid || state === 'loading') return;
    await sendCode();
  }

  async function submitCode(e: SubmitEvent) {
    e.preventDefault();
    const cleaned = code.replace(/\D/g, '');
    if (cleaned.length !== 6 || state === 'verifying') return;

    setState('verifying');
    setCodeError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email: email.trim().toLowerCase(),
          code:  cleaned,
        }),
      });
      const data = await res.json() as { ok: boolean; redirectTo?: string; error?: string };
      if (data.ok && data.redirectTo) {
        window.location.assign(data.redirectTo);
        return;
      }
      setCodeError(data.error ?? 'Invalid code.');
      setState('sent');
    } catch {
      setCodeError('Network error - check your connection.');
      setState('sent');
    }
  }

  // ---- Sent state: code-input + countdown + resend ----
  if (state === 'sent' || state === 'verifying') {
    return (
      <div class="space-y-4">
        <div class="rounded-lg border border-accent-support/20 bg-accent-support/5 px-5 py-5">
          <p class="text-base font-medium text-ink-strong mb-1">Check your email</p>
          <p class="text-sm text-accent-support leading-relaxed">
            We sent a sign-in link and a 6-digit code to <strong>{email}</strong>.
          </p>
          <p class="text-xs text-accent-support mt-2 tabular-nums">
            {expired ? (
              <span class="text-red-700 font-medium">Code expired - request a new one</span>
            ) : (
              <>Code expires in <strong>{mins}:{secs.toString().padStart(2, '0')}</strong></>
            )}
          </p>
        </div>

        <div class="rounded-lg border border-hairline bg-surface px-5 py-5 space-y-3">
          <p class="text-sm text-ink font-medium">Enter the 6-digit code</p>
          <p class="text-xs text-muted leading-relaxed">
            Use this if you'll click the email link on a different device.
            Otherwise, click the link in the email directly.
          </p>
          <form onSubmit={submitCode} class="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              autocomplete="one-time-code"
              maxLength={6}
              value={code}
              onInput={(e) => setCode((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
              placeholder="123456"
              class={`w-full rounded-md border px-3 py-3 text-2xl tracking-[0.5em] font-mono text-center
                     focus:outline-none focus:ring-2 transition-colors disabled:bg-paper
                     ${expired
                       ? 'border-red-200 focus:ring-red-300 focus:border-red-400'
                       : 'border-hairline focus:ring-accent-support focus:border-accent-support'}`}
              disabled={state === 'verifying' || expired}
              autoFocus
            />
            {codeError && <p class="text-xs text-red-600">{codeError}</p>}
            <button
              type="submit"
              disabled={code.length !== 6 || state === 'verifying' || expired}
              class="w-full rounded-md bg-accent-support px-4 py-2.5 text-sm font-medium text-white
                     hover:bg-accent-support/90 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
            >
              {state === 'verifying' ? 'Verifying…' : 'Sign in with code'}
            </button>
          </form>
        </div>

        <div class="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={!expired && msRemaining > CODE_TTL_MS - 30_000} // 30s cooldown to avoid spam
            class="text-accent-support hover:text-accent-support disabled:text-muted disabled:cursor-not-allowed underline underline-offset-2"
          >
            {expired ? 'Send a new code' : 'Resend code'}
          </button>
          <button
            type="button"
            class="text-muted hover:text-ink underline underline-offset-2"
            onClick={() => {
              setState('idle');
              setEmail('');
              setCode('');
              setCodeError('');
              setSentAt(null);
            }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  // ---- Idle / loading / error: email-input form ----
  return (
    <form onSubmit={submitEmail} class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-ink mb-1">
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
          class="w-full rounded-md border border-hairline px-3 py-2.5 text-base shadow-sm
                 focus:border-accent-support focus:outline-none focus:ring-1 focus:ring-accent-support
                 disabled:bg-paper"
          disabled={state === 'loading'}
        />
      </div>

      {state === 'error' && <p class="text-sm text-red-600">{errMsg}</p>}

      <button
        type="submit"
        disabled={invalid || state === 'loading'}
        class="w-full rounded-md bg-accent-support px-4 py-2.5 text-sm font-medium text-white
               hover:bg-accent-support/90 disabled:opacity-50 disabled:cursor-not-allowed
               transition-colors"
      >
        {state === 'loading' ? 'Sending…' : 'Send sign-in link'}
      </button>

      <p class="text-xs text-muted text-center">
        No password needed. We'll email you a link plus a 6-digit code.
      </p>
    </form>
  );
}
