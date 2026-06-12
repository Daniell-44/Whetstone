import type { AuthDb } from './db';
import type { RateLimitKV } from '../rate-limit';
import type { EmailSender } from './email';
import { generateOpaqueToken, hashToken, generateId, generateSixDigitCode } from './tokens';
import { sessionExpiresAt, sessionCookieHeader, clearSessionCookieHeader, getSessionIdFromRequest } from './sessions';
import { checkAndIncrementQuota } from '../rate-limit';

export interface RequestLinkDeps {
  db:             AuthDb;
  rateLimitKv:    RateLimitKV;
  sendEmail:      EmailSender;
  siteUrl:        string;
  authHourlyCap?: number;
  /**
   * When true, log the magic link URL and 6-digit code to console.log so they
   * can be retrieved via `wrangler tail`. ONLY enable this during development
   * or while debugging email delivery - never in real production.
   */
  debugLogCodes?: boolean;
}

export interface VerifyDeps {
  db: AuthDb;
}

export interface VerifyCodeDeps {
  db:          AuthDb;
  rateLimitKv: RateLimitKV;
}

const MAX_CODE_ATTEMPTS = 5;

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
  // Bump the cap in debug mode so iterating during testing isn't blocked.
  const cap     = deps.authHourlyCap ?? (deps.debugLogCodes ? 200 : 5);
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

  const obj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const rawEmail = 'email' in obj ? String(obj.email).trim().toLowerCase() : '';
  if (!rawEmail || !rawEmail.includes('@')) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  // Validate returnTo - must be a same-origin path starting with '/' and NOT
  // starting with '//' (which would be a protocol-relative URL pointing
  // off-site). Limited to 200 chars to keep the column lean.
  const rawReturnTo = 'returnTo' in obj ? String(obj.returnTo) : '';
  const returnTo = sanitiseReturnTo(rawReturnTo);

  // Build a debug payload that the API will optionally echo to the client
  // when debugLogCodes is on. Off by default; never set in real production.
  let debugPayload: { code: string; link: string } | null = null;

  // Always return ok - never reveal whether an email address is registered.
  try {
    let user = await deps.db.findUserByEmail(rawEmail);
    if (!user) {
      const userId = generateId();
      await deps.db.createUser(userId, rawEmail);
      user = { id: userId, email: rawEmail, created_at: new Date().toISOString(), terminology_preference: 'plain' };
    }

    const token      = generateOpaqueToken();
    const tokenHash  = await hashToken(token);
    const code       = generateSixDigitCode();
    const codeHash   = await hashToken(code);
    const expiresAt  = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString();
    await deps.db.createMagicLink(generateId(), user.id, tokenHash, expiresAt, returnTo, codeHash);

    const magicLink = `${deps.siteUrl}/api/auth/verify?token=${token}`;

    if (deps.debugLogCodes) {
      console.log(`[auth-debug] email=${rawEmail} code=${code} link=${magicLink}`);
      debugPayload = { code, link: magicLink };
    }

    try {
      await deps.sendEmail(rawEmail, magicLink, code);
    } catch (err) {
      console.error(`[auth] sendEmail failed for ${rawEmail}: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    console.error(`[auth] request-link path failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // If debug-mode is on, include the code in the response so it can be read
  // from Chrome DevTools Network tab (useful when email + wrangler tail are
  // both unavailable). Never include in real production.
  const responseBody: Record<string, unknown> = { ok: true };
  if (debugPayload) responseBody.__debug = debugPayload;

  return new Response(JSON.stringify(responseBody), { status: 200, headers: JSON_HEADERS });
}

/**
 * Validate a returnTo string. Returns null if invalid (caller treats null as
 * "use default destination"). Defends against open-redirect attacks.
 */
function sanitiseReturnTo(raw: string): string | null {
  if (!raw) return null;
  if (raw.length > 200) return null;
  if (!raw.startsWith('/')) return null;     // must be a path
  if (raw.startsWith('//')) return null;     // protocol-relative - off-site
  if (raw.includes('\\')) return null;       // backslashes can confuse URL parsers
  // Whitelist additional shape: only safe URL characters
  if (!/^[a-zA-Z0-9/_\-?=&.%~]+$/.test(raw)) return null;
  return raw;
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

  // Use the stored returnTo if any; default to /account.
  const destination = link.return_to ?? '/account';

  return new Response(null, {
    status: 302,
    headers: { Location: destination, 'Set-Cookie': sessionCookieHeader(sessionId) },
  });
}

/**
 * Verify a 6-digit code sent by email. Used for cross-device sign-in:
 * user receives the email on their phone but completes sign-in on their
 * laptop by typing the code displayed on the requesting page.
 *
 * Security:
 *   - Code is hashed (SHA-256) in storage; we compare hashes, not plaintext
 *   - Per-link attempt counter caps at 5 - wrong code 5 times locks the link
 *   - Per-IP rate limit (3 attempts per 10 min) on top of per-link
 *   - Same single-use semantic as the link: consumed_at gets set on success
 */
export async function handleVerifyCode(
  request: Request,
  deps:    VerifyCodeDeps,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405, headers: JSON_HEADERS,
    });
  }

  // IP rate limit - per IP per 10-minute window, hard cap.
  const ip      = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
  const window  = Math.floor(Date.now() / (10 * 60 * 1000));
  const rlKey   = `auth:code:rl:${ip}:${window}`;
  const { allowed } = await checkAndIncrementQuota(deps.rateLimitKv, rlKey, 10);
  if (!allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Too many code attempts. Try again later.' }), {
      status: 429, headers: JSON_HEADERS,
    });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  const obj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const email = 'email' in obj ? String(obj.email).trim().toLowerCase() : '';
  const code  = 'code'  in obj ? String(obj.code).trim()                : '';

  if (!email || !email.includes('@') || !/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid input' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  const user = await deps.db.findUserByEmail(email);
  if (!user) {
    // Don't reveal whether the email is registered.
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  const link = await deps.db.findLatestActiveMagicLinkForUser(user.id);
  if (!link || !link.code_hash) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  if (link.code_attempts >= MAX_CODE_ATTEMPTS) {
    return new Response(JSON.stringify({ ok: false, error: 'Too many wrong attempts. Request a new code.' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  const candidateHash = await hashToken(code);
  if (candidateHash !== link.code_hash) {
    await deps.db.incrementMagicLinkCodeAttempts(link.id);
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code' }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  // Code matched. Consume the link and mint a session.
  await deps.db.markMagicLinkConsumed(link.id);

  const sessionId = generateOpaqueToken();
  await deps.db.createSession(sessionId, user.id, sessionExpiresAt());

  const destination = link.return_to ?? '/account';

  return new Response(JSON.stringify({ ok: true, redirectTo: destination }), {
    status:  200,
    headers: { ...JSON_HEADERS, 'Set-Cookie': sessionCookieHeader(sessionId) },
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
