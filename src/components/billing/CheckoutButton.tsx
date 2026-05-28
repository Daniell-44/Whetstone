import { useState } from 'preact/hooks';

export default function CheckoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleClick() {
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json() as { ok: boolean; url?: string; error?: { message: string } };
      if (data.ok && data.url) {
        window.location.assign(data.url);
      } else {
        setError(data.error?.message ?? 'Something went wrong. Please try again.');
        setIsLoading(false);
      }
    } catch {
      setError('Network error — check your connection and try again.');
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
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-amber-500 text-white hover:bg-amber-600'
        }`}
      >
        {isLoading ? 'Redirecting to checkout…' : 'Subscribe — $15/mo'}
      </button>
      {error && (
        <p class="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
