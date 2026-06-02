import type { AuthDb } from './db';
import type { RateLimitKV } from '../rate-limit';
import type { EmailSender } from './email';
import { generateOpaqueToken, hashToken, generateId } from './tokens';
import { sessionExpiresAt, sessionCookieHeader, clearSessionCookieHeader, getSessionIdFromRequest } from './sessions';
import { checkAndIncrementQuota } from '../rate-limit';

export interface RequestLinkDeps {
  db:             AuthDb;
  rateLimitKv:    RateLimitKV;
  sendEmail:      EmailSender;
  siteUrl:        string;
  authHourlyCap?: number;
}

export interface VerifyDeps {
  db: AuthDb;
}

export interface LogoutDeps {
  db: AuthDb;
}

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function currentHour(): string {
  return new Date().toISOString().slice(0, 13); // "2025-01-01T12"
}

export async function handleRequestLink(
  request: Request,
  deps: RequestLinkDeps,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405, headers: JSON_HEADERS,
    });
  }

  const ip      = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
  const rlKey   = `auth:rl:${ip}:${currentHour()}`;
  const cap     = deps.authHourlyCap ?? 5;
  const { allowed } = await checkAndIncrementQuota(deps.rateLimitKv, rlKey, cap);
  if (!allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Too many requests. Try again in an hour.' }), {
      status: 429, headers: JSON_HEADERS,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  const rawEmail = typeof body === 'object' && body !== null && 'email' in body
    ? String((body as Record<string, unknown>).email).trim().toLowerCase()
    : '';
  if (!rawEmail || !rawEmail.includes('@')) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  // Always return ok — never reveal whether an email address is registered.
  try {
    let user = await deps.db.findUserByEmail(rawEmail);
    if (!user) {
      const userId = generateId();
      await deps.db.createUser(userId, rawEmail);
      user = { id: userId, email: rawEmail, created_at: new Date().toISOString(), terminology_preference: 'plain' };
    }

    const token      = generateOpaqueToken();
    const tokenHash  = await hashToken(token);
    const expiresAt  = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();
    await deps.db.createMagicLink(generateId(), user.id, tokenHash, expiresAt);

    await deps.sendEmail(rawEmail, `${deps.siteUrl}/api/auth/verify?token=${token}`);
  } catch {
    // Swallow — anti-enumeration; still return ok.
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
}

export async function handleVerify(
  request: Request,
  deps: VerifyDeps,
): Promise<Response> {
  const url   = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response(null, { status: 302, headers: { Location: '/login?error=invalid' } });
  }

  const tokenHash = await hashToken(token);
  const link      = await deps.db.findMagicLinkByTokenHash(tokenHash);

  if (!link || link.consumed_at !== null || new Date(link.expires_at) < new Date()) {
    return new Response(null, { status: 302, headers: { Location: '/login?error=invalid' } });
  }

  await deps.db.markMagicLinkConsumed(link.id);

  const sessionId = generateOpaqueToken();
  await deps.db.createSession(sessionId, link.user_id, sessionExpiresAt());

  return new Response(null, {
    status: 302,
    headers: { Location: '/account', 'Set-Cookie': sessionCookieHeader(sessionId) },
  });
}

export async function handleLogout(
  request: Request,
  deps: LogoutDeps,
): Promise<Response> {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) {
    await deps.db.deleteSession(sessionId);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/', 'Set-Cookie': clearSessionCookieHeader() },
  });
}
