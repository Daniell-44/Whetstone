// The reader dial (Decision 19-B, 2026-08-08): a zero-JS POST form on the
// briefing page increments an anonymous per-(slug, step) count in D1, then
// bounces the reader back to the page. Results stay hidden until fifty
// answers exist (the n=50 gate decided with the storey design) so early
// votes can't read as a finding.
//
// Kept behind a narrow interface so the handler tests run against an
// in-memory fake (same shape as the email-capture module).

export const DIAL_STEPS = [-2, -1, 0, 1, 2] as const;
export type DialStep = (typeof DIAL_STEPS)[number];

export const RESULTS_FLOOR = 50;

export interface DialDb {
  /** UPSERT: create the (slug, step) row at 1 or increment it. */
  increment(slug: string, step: DialStep): Promise<void>;
  /** All counts for one briefing. Missing steps simply have no row. */
  counts(slug: string): Promise<{ step: number; n: number }[]>;
}

export function makeDialDb(d1: D1Database): DialDb {
  return {
    increment: async (slug, step) => {
      await d1
        .prepare(
          `INSERT INTO briefing_dial_votes (slug, step, n, updated_at)
           VALUES (?, ?, 1, datetime('now'))
           ON CONFLICT (slug, step) DO UPDATE SET n = n + 1, updated_at = datetime('now')`,
        )
        .bind(slug, step)
        .run();
    },
    counts: async (slug) => {
      const result = await d1
        .prepare('SELECT step, n FROM briefing_dial_votes WHERE slug = ? ORDER BY step')
        .bind(slug)
        .all<{ step: number; n: number }>();
      return result.results;
    },
  };
}

// A briefing slug is a kebab filename — anything else is rejected before it
// reaches SQL (parameterised anyway; this keeps junk rows out of the table).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function parseDialStep(raw: string | null): DialStep | null {
  // Canonical integer strings only: Number('') and Number('00') are both 0,
  // which would let a hand-crafted POST register centre votes.
  if (raw === null || !/^-?[0-2]$/.test(raw.trim())) return null;
  const n = Number(raw);
  return (DIAL_STEPS as readonly number[]).includes(n) ? (n as DialStep) : null;
}

export interface DialVoteDeps {
  db: Pick<DialDb, 'increment'>;
  /** KV guard: a handful of taps per IP per briefing per day. Not identity —
     a spam damper. Absent KV (tests) means no limit. */
  rateLimitKv?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  };
  dailyCap?: number;
}

/** Handle the dial form POST. Always answers with a 303 back to the
   briefing's Your-turn storey — a vote is fire-and-forget for the reader;
   invalid input just bounces without counting. */
export async function handleDialVote(request: Request, deps: DialVoteDeps): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const slug = String(form?.get('slug') ?? '');
  const step = parseDialStep(form ? String(form.get('step') ?? '') : null);

  const back = (frag: string, ok: boolean) =>
    new Response(null, { status: 303, headers: { Location: `/briefing/${SLUG_RE.test(slug) ? slug : ''}#${frag}`, 'X-Dial': ok ? 'counted' : 'ignored' } });

  if (!SLUG_RE.test(slug) || step === null) {
    return new Response(null, { status: 303, headers: { Location: '/', 'X-Dial': 'ignored' } });
  }

  if (deps.rateLimitKv) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const key = `dial:${slug}:ip:${ip}`;
    const used = Number((await deps.rateLimitKv.get(key)) ?? '0');
    if (used >= (deps.dailyCap ?? 5)) return back('dial-thanks', false);
    await deps.rateLimitKv.put(key, String(used + 1), { expirationTtl: 60 * 60 * 24 });
  }

  await deps.db.increment(slug, step);
  return back('dial-thanks', true);
}

/** Results for one briefing, gated: below the floor the caller learns only
   the total, never the shape — early counts must not read as a finding. */
export async function dialResults(db: Pick<DialDb, 'counts'>, slug: string): Promise<
  { total: number; gated: true } | { total: number; gated: false; counts: Record<string, number> }
> {
  if (!SLUG_RE.test(slug)) return { total: 0, gated: true };
  const rows = await db.counts(slug);
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (total < RESULTS_FLOOR) return { total, gated: true };
  const counts: Record<string, number> = {};
  for (const s of DIAL_STEPS) counts[String(s)] = 0;
  for (const r of rows) if ((DIAL_STEPS as readonly number[]).includes(r.step)) counts[String(r.step)] = r.n;
  return { total, gated: false, counts };
}
