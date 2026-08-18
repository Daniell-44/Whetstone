// Narrow interface so the rate-limit helpers work against any KV-alike
// (the real Cloudflare KVNamespace in production; a Map-backed fake in tests).
export interface RateLimitKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export type QuotaPeriod = 'day' | 'month';

interface QuotaRecord {
  count:  number;
  period: string; // 'YYYY-MM-DD' for day, 'YYYY-MM' for month
}

export function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
}

export function utcMonthString(): string {
  return new Date().toISOString().slice(0, 7);    // YYYY-MM
}

function periodKey(period: QuotaPeriod): string {
  return period === 'month' ? utcMonthString() : utcDateString();
}

// TTL: a bit over the period length so stale keys expire naturally.
// Day → ~25h. Month → ~32 days.
function periodTtl(period: QuotaPeriod): number {
  return period === 'month' ? 32 * 24 * 60 * 60 : 90_000;
}

/**
 * Check and increment a usage quota. Defaults to a daily period (all existing
 * callers rely on this). Pass period='month' for monthly caps (paid tiers).
 */
export async function checkAndIncrementQuota(
  kv:      RateLimitKV,
  key:     string,
  cap:     number,
  period:  QuotaPeriod = 'day',
): Promise<{ allowed: boolean; resetAt: string; remaining: number }> {
  const current = periodKey(period);
  const raw     = await kv.get(key);
  const record: QuotaRecord = raw
    ? (JSON.parse(raw) as QuotaRecord)
    : { count: 0, period: current };

  if (record.period !== current) {
    record.count  = 0;
    record.period = current;
  }

  const resetAt = period === 'month'
    ? `${current}-01T00:00:00Z (next month)`
    : `${current}T23:59:59Z`;

  if (record.count >= cap) {
    return { allowed: false, resetAt, remaining: 0 };
  }

  record.count++;
  await kv.put(key, JSON.stringify(record), { expirationTtl: periodTtl(period) });
  return { allowed: true, resetAt, remaining: Math.max(0, cap - record.count) };
}

// ---------------------------------------------------------------------------
// The anonymous session gate.
//
// Daniel, 2026-08-14: "all features should be in free tier, no sign in needed
// for now but force sign in if one session has >3 uses."
//
// So an anonymous visitor gets three analysis runs per browser session, then
// every further run answers 401 SIGNIN_REQUIRED and the UI offers sign-in.
// Signed-in users never pass through this gate at all; their existing per-user
// daily caps are the ceiling.
//
// HOW THE SESSION IS COUNTED. A random id in a session cookie (no Max-Age, so
// it dies when the browser closes, which is what "one session" means), and a
// counter in KV under that id with a 24-hour backstop TTL so an always-open
// browser does not hold a session forever. The count lives server-side, not in
// the cookie, so editing the cookie only ever resets someone to a fresh three:
// clearing cookies was always going to do that, and chasing it further buys
// nothing but complexity.
//
// WHY THE GATE IS AT THE ENDPOINT, NOT IN THE HANDLERS. The handlers return
// many different Responses, and the Set-Cookie for a newly minted id has to
// ride whichever one goes out. Wrapping at the endpoint keeps the handlers
// pure request-in response-out, which is also what their tests assume.
// ---------------------------------------------------------------------------

export const ANON_SESSION_CAP = 3;
const ANON_COOKIE = 'ws_anon';
const ANON_TTL_SECONDS = 24 * 60 * 60;

export interface AnonGate {
  /** Set when the visitor is over the cap: return this instead of running. */
  block?: Response;
  /** Set on a first-ever run: append to whatever response goes out. */
  setCookie?: string;
  /** Stable id for this anonymous session, for quota keys. */
  anonId: string;
  /**
   * Count this run. Call ONLY after the handler produced a real result
   * (status under 400).
   *
   * The first version incremented at check time, which made a failed
   * validation cost a use: three typos and a visitor was asked to sign in
   * without ever getting one analysis. A use is a RUN, not an attempt, so the
   * check and the count are separate and the endpoint commits on success.
   */
  commit: () => Promise<void>;
}

/**
 * Whether a finished request should spend one of the session's runs.
 *
 * In code, and here rather than in a route, because the route it came from is
 * the one place with no test coverage. Two rules, both learned the hard way:
 *
 *   A use is a RUN, not an attempt. A 4xx spends nothing, or three typos would
 *   cost a visitor their whole session.
 *
 *   For staged work only the EXPENSIVE stage counts. A question is answered by
 *   an outline call and then a full call; charging both would silently halve
 *   the three runs the visitor was promised.
 */
export function shouldCommitAnonUse(depth: unknown, status: number): boolean {
  return depth === 'full' && status < 400;
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export async function anonSessionGate(request: Request, kv: RateLimitKV | undefined): Promise<AnonGate> {
  const existing = readCookie(request, ANON_COOKIE);
  const fresh = !existing || !/^[a-z0-9-]{8,64}$/.test(existing);
  const anonId = fresh ? crypto.randomUUID() : existing!;

  const key = `anonsess:${anonId}`;
  const commit = async () => {
    if (!kv) return;
    const n = parseInt((await kv.get(key)) ?? '0', 10) + 1;
    await kv.put(key, String(n), { expirationTtl: ANON_TTL_SECONDS });
  };

  // No KV means no way to count, and failing OPEN is the right way to fail: a
  // storage outage must not lock every anonymous visitor out of a free tool.
  if (kv) {
    const used = parseInt((await kv.get(key)) ?? '0', 10);
    if (used >= ANON_SESSION_CAP) {
      return {
        anonId,
        commit,
        block: new Response(JSON.stringify({
          ok: false,
          error: {
            code: 'SIGNIN_REQUIRED',
            message: `That's ${ANON_SESSION_CAP} runs this session. Sign in (free) to keep going.`,
          },
        }), { status: 401, headers: { 'content-type': 'application/json' } }),
      };
    }
  }

  return {
    anonId,
    commit,
    setCookie: fresh
      ? `${ANON_COOKIE}=${anonId}; Path=/; HttpOnly; Secure; SameSite=Lax`
      : undefined,
  };
}
