import type { AuthDb, DbSession } from './db';

export const SESSION_COOKIE  = 'whetstone_session';
const SESSION_TTL_MS         = 30 * 24 * 60 * 60 * 1000;
const COOKIE_MATCH_RE        = /(?:^|;\s*)whetstone_session=([^;]+)/;

export function sessionExpiresAt(now = Date.now()): string {
  return new Date(now + SESSION_TTL_MS).toISOString();
}

export function sessionCookieHeader(sessionId: string, now = Date.now()): string {
  const expires = new Date(now + SESSION_TTL_MS).toUTCString();
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function getSessionIdFromRequest(request: Request): string | null {
  const cookie = request.headers.get('Cookie') ?? '';
  const match  = COOKIE_MATCH_RE.exec(cookie);
  return match?.[1] ?? null;
}

export async function getSessionFromRequest(
  request: Request,
  db: AuthDb,
): Promise<DbSession | null> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;

  const session = await db.findSessionById(sessionId);
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  // Sliding expiry, throttled: only write when the session hasn't been extended
  // in the last day, so we don't issue a D1 write on every authenticated read.
  const EXTEND_THRESHOLD_MS = 29 * 24 * 60 * 60 * 1000;
  if (new Date(session.expires_at).getTime() - Date.now() < EXTEND_THRESHOLD_MS) {
    await db.extendSession(session.id, sessionExpiresAt());
  }
  return session;
}
