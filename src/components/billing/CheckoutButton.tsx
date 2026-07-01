import { useState } from 'preact/hooks';

export default function CheckoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      // Try to read JSON; some 500s have empty bodies, so guard parse.
      let data: { ok?: boolean; url?: string; error?: { message: string } } = {};
      try { data = await res.json(); } catch { /* empty body */ }
      if (data.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      // Not signed in: bounce to /login with returnTo so they come back to
      // /pricing after auth and can click Subscribe again from a signed-in
      // session - no manual navigation required.
      if (res.status === 401) {
        window.location.assign('/login?returnTo=/pricing');
        return;
      }
      const msg = data.error?.message
        ?? (res.status === 500 ? `Server error (500). Stripe may not be configured yet.`
          : res.status === 402 ? `Subscription required.`
          : `Checkout failed (${res.status}).`);
      setError(msg);
      setIsLoading(false);
    } catch (e) {
      setError(`Network error: ${(e as Error).message ?? 'unknown'}`);
      setIsLoading(false);
    }
  }

  return (
    <div class="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        class={`w-full py-3 px-6 rounded-xl text-sm font-semibold transition-colors ${
          isLoading
            ? 'bg-hairline/40 text-muted cursor-not-allowed'
            : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
      >
        {isLoading ? 'Redirecting to checkout…' : 'Subscribe - A$33/mo'}
      </button>
      {error && (
        <p class="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
