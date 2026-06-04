import { makeErrorDb } from './db';

// ---------------------------------------------------------------------------
// Hash IP for grouping without storing PII
// ---------------------------------------------------------------------------

async function hashIp(ip: string): Promise<string> {
  const encoded = new TextEncoder().encode(ip + ':whetstone-salt');
  const buffer  = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Error logging — call this in catch blocks
// ---------------------------------------------------------------------------

export async function logServerError(
  d1:      D1Database,
  request: Request,
  status:  number,
  error:   unknown,
): Promise<void> {
  try {
    const db  = makeErrorDb(d1);
    const url = new URL(request.url);
    const ip  = request.headers.get('CF-Connecting-IP') ?? 'unknown';

    await db.logError({
      id:         crypto.randomUUID(),
      timestamp:  Date.now(),
      method:     request.method,
      path:       url.pathname,
      status,
      error_type: error instanceof Error ? error.constructor.name : typeof error,
      message:    error instanceof Error ? error.message : String(error),
      stack:      error instanceof Error ? (error.stack ?? null) : null,
      ip_hash:    await hashIp(ip),
      user_agent: request.headers.get('User-Agent'),
    });
  } catch {
    // Error logging itself failed — never let this crash the response.
    // This is the one place where silent failure is correct.
  }
}
