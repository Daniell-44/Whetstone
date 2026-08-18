/**
 * Keeping every mini-briefing run.
 *
 * Daniel, 2026-08-13: "can you save the mini breifings made to a data base on
 * the site which i can access? and then maybe can even eval to see if there is
 * trends in output to improve".
 *
 * Two rules live here rather than in the callers, because a rule enforced at
 * the call site is a rule that survives exactly as long as the current caller.
 *
 * 1. THE URL RULE. A readable URL is stored only for a signed-in run. Anonymous
 *    runs keep a SHA-256 hash and nothing else, matching what the placement
 *    cache already does. Today the only signed-in user is the owner, so this
 *    costs nothing and means the policy is already true when a second user
 *    arrives, rather than being a migration nobody remembers to write.
 *
 * 2. SAVING MUST NEVER BREAK A RUN. The reader asked for a briefing, not for
 *    bookkeeping. Every failure here is swallowed and logged. A dead database
 *    must not turn a working briefing into an error.
 */
import type { MiniBriefing, MiniTrigger, MiniSource } from './mini';

/**
 * Stamped on every row. Change it whenever the prompts, the gates or the model
 * change, and note what changed below.
 *
 * Without this, a shift in output quality cannot be attributed: the prompt
 * changed, the model drifted underneath, and the articles were different, all
 * at once. A before-and-after across a version boundary is a real comparison.
 * A before-and-after without one is a guess.
 *
 * v1  2026-08-13  first stored version. Outline thinking budget 512, dispute-
 *                 angle retrieval, character-exact quote gate, subject-match
 *                 relevance gate, sources ordered dispute first.
 */
export const PIPELINE_VERSION = 'mini-v1';

// Gemini 2.5 Flash list prices, 13 August 2026. Grounded search bills per
// request, separately from tokens, and is about 91% of the total.
const IN_PER_M = 0.30, OUT_PER_M = 2.50, GROUNDING_PER_CALL = 0.035;

export function costOf(cost: MiniBriefing['cost']): number {
  return (cost.inputTokens / 1e6) * IN_PER_M
    + (cost.outputTokens / 1e6) * OUT_PER_M
    + cost.groundedCalls * GROUNDING_PER_CALL;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Host only, lowercased, no www. Enough to ask which sources are worth fetching. */
export function domainOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

export interface SaveInput {
  briefing: MiniBriefing;
  trigger: MiniTrigger;
  depth: 'outline' | 'full';
  model: string;
  inputChars: number;
  url?: string;
  title?: string;
  /** Null for anonymous. Decides whether the URL is stored in readable form. */
  userId?: string | null;
  /** Minted by the caller with newMiniId() so it can be returned before the write. */
  id: string;
}

export interface MiniDb {
  prepare(sql: string): {
    bind(...values: unknown[]): { run(): Promise<unknown>; all<T>(): Promise<{ results: T[] }>; first<T>(): Promise<T | null> };
  };
  batch(statements: unknown[]): Promise<unknown>;
}

/**
 * Minted by the CALLER, before the write.
 *
 * The row is written after the response goes out, so the id cannot be waited
 * for. It is needed in the response regardless: it is the address of the
 * briefing and the handle the owner marks a verdict against. So the id exists
 * first and the write catches up.
 */
export function newMiniId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

/**
 * Write one run and every source it considered.
 *
 * Returns the id on success and null on any failure. Callers should not branch
 * on the failure beyond logging it: see rule 2 above.
 */
export async function saveMiniBriefing(db: MiniDb, input: SaveInput): Promise<string | null> {
  try {
    const { briefing: b, id } = input;
    const urlHash = await sha256Hex(input.url ?? '');
    // Rule 1, in one line, where it cannot be forgotten.
    const storedUrl = input.userId ? (input.url ?? null) : null;

    const claimCount = b.premises.length + (b.tier === 'premises' ? 0 : b.opposing.length);

    await db.prepare(
      `INSERT INTO mini_briefings (
         id, user_id, trigger, depth, pipeline_version, model,
         url, url_hash, title, input_chars,
         tier, question, conclusion, claim_count, premise_count, payload,
         outline_ms, total_ms, calls, grounded_calls, input_tokens, output_tokens, cost_usd,
         dropped_unverified, dropped_off_claim
       ) VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?)`,
    ).bind(
      id, input.userId ?? null, input.trigger, input.depth, PIPELINE_VERSION, input.model,
      storedUrl, urlHash, input.title ?? null, input.inputChars,
      b.tier, b.question || null, b.conclusion || null, claimCount, b.premises.length,
      // The payload is what a reader would see, and nothing else. Everything
      // stripped here has its own table. Leaving `replay` in would duplicate
      // about 70KB of article and page text into a column that every trend
      // query has to read past.
      JSON.stringify({ ...b, considered: undefined, replay: undefined, fetchLedger: undefined, attempts: undefined }),
      b.timing.outlineMs, b.timing.totalMs, b.cost.calls, b.cost.groundedCalls,
      b.cost.inputTokens, b.cost.outputTokens, costOf(b.cost),
      b.dropped.unverified, b.dropped.offClaim,
    ).run();

    const rows: MiniSource[] = b.considered ?? [];
    for (const s of rows) {
      try {
        await db.prepare(
          `INSERT INTO mini_sources (
             briefing_id, claim, who, publication, domain, stance, kept, drop_stage, drop_reason,
             quote_chars, url, attempted_quote
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(
          id, s.claim ?? '', s.who ?? null, s.publication ?? null,
          domainOf(s.resolvedUrl ?? s.url), s.stance ?? null,
          s.dropStage ? 0 : 1, s.dropStage ?? null,
          s.relevanceNote ?? s.verifyNote ?? null,
          (s.quote ?? s.attemptedQuote)?.length ?? null, s.resolvedUrl ?? s.url ?? null,
          // Only on the dropped rows. A kept quote is already in the payload,
          // and storing it twice would just be two places to keep in step.
          s.dropStage ? (s.attemptedQuote ?? null) : null,
        ).run();
      } catch (e) {
        console.error('mini store: source row failed', e);
      }
    }

    for (const [i, a] of (b.attempts ?? []).entries()) {
      try {
        await db.prepare(
          `INSERT INTO mini_claims (briefing_id, position, claim, load, researched, sourced, outcome, queries)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).bind(
          id, i, a.claim, a.load ?? null, a.researched ? 1 : 0, a.sourced ? 1 : 0,
          a.outcome, JSON.stringify(a.queries ?? []),
        ).run();
      } catch (e) {
        console.error('mini store: claim row failed', e);
      }
    }

    for (const f of b.fetchLedger ?? []) {
      try {
        await db.prepare(
          `INSERT INTO mini_fetches (briefing_id, url, resolved_url, domain, ms, status, outcome, chars)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).bind(
          id, f.url, f.resolvedUrl ?? null, f.domain ?? null,
          f.ms ?? null, f.status ?? null, f.outcome, f.chars ?? null,
        ).run();
      } catch (e) {
        console.error('mini store: fetch row failed', e);
      }
    }

    if (b.replay) {
      try {
        await db.prepare(
          `INSERT INTO mini_replay (briefing_id, article_text, pages) VALUES (?,?,?)`,
        ).bind(id, b.replay.articleText, JSON.stringify(b.replay.pages)).run();
      } catch (e) {
        // Replay is the largest write and the least urgent. Losing it costs a
        // future test case, not this run's record, so it must not take the
        // rest of the row down with it.
        console.error('mini store: replay row failed', e);
      }
    }
    return id;
  } catch (e) {
    console.error('mini store: save failed', e);
    return null;
  }
}

export interface MiniRow {
  id: string; created_at: string; trigger: string; depth: string;
  pipeline_version: string; url: string | null; title: string | null;
  tier: string; question: string | null; conclusion: string | null;
  claim_count: number; premise_count: number;
  total_ms: number | null; outline_ms: number | null; cost_usd: number;
  dropped_unverified: number; dropped_off_claim: number;
  verdict: string | null; verdict_note: string | null;
  // Publication (migration 0026). Optional on the type because the older
  // queries that predate the columns still map onto this row.
  published?: number;
  slug?: string | null;
  published_at?: string | null;
  /** Sources that survived both gates. Only the list query computes it. */
  kept_sources?: number;
}

export async function listMiniBriefings(db: MiniDb, limit = 100): Promise<MiniRow[]> {
  const r = await db.prepare(
    // kept_sources is joined in so the admin list can show at a glance which
    // runs could be published. The real floor is re-checked against the stored
    // payload at publish time; this is only for the eye.
    `SELECT b.id, b.created_at, b.trigger, b.depth, b.pipeline_version, b.url, b.title, b.tier,
            b.question, b.conclusion, b.claim_count, b.premise_count, b.total_ms, b.outline_ms,
            b.cost_usd, b.dropped_unverified, b.dropped_off_claim, b.verdict, b.verdict_note,
            b.published, b.slug, b.published_at,
            (SELECT COUNT(*) FROM mini_sources s WHERE s.briefing_id = b.id AND s.kept = 1) AS kept_sources
       FROM mini_briefings b ORDER BY b.created_at DESC LIMIT ?`,
  ).bind(limit).all<MiniRow>();
  return r.results ?? [];
}

export async function getMiniBriefing(db: MiniDb, id: string): Promise<{ row: MiniRow; payload: unknown; sources: unknown[] } | null> {
  if (!/^[a-z0-9]{1,20}$/.test(id)) return null;
  const row = await db.prepare(
    `SELECT * FROM mini_briefings WHERE id = ?`,
  ).bind(id).first<MiniRow & { payload: string }>();
  if (!row) return null;
  const src = await db.prepare(
    `SELECT claim, who, publication, domain, stance, kept, drop_stage, drop_reason, url
       FROM mini_sources WHERE briefing_id = ? ORDER BY kept DESC, id ASC`,
  ).bind(id).all<unknown>();
  let payload: unknown = null;
  try { payload = JSON.parse(row.payload); } catch { /* keep null */ }
  return { row, payload, sources: src.results ?? [] };
}

/**
 * Which stage was wrong, when one was.
 *
 * "Wrong" on its own does not say whether the outline picked bad claims,
 * retrieval found nothing, the quote gate let a paraphrase through, or the
 * relevance gate passed a mismatch. Those are four different pieces of work,
 * and in three months nobody will remember which one a given run was.
 */
export const VERDICT_STAGES = ['outline', 'retrieval', 'quote', 'relevance', 'other'] as const;

export async function setVerdict(
  db: MiniDb, id: string, verdict: string, note: string | null, stage?: string | null,
): Promise<boolean> {
  if (!/^[a-z0-9]{1,20}$/.test(id)) return false;
  if (!['right', 'wrong', 'mixed'].includes(verdict)) return false;
  const cleanStage = stage && (VERDICT_STAGES as readonly string[]).includes(stage) ? stage : null;
  try {
    await db.prepare(
      `UPDATE mini_briefings
          SET verdict = ?, verdict_note = ?, verdict_stage = ?, verdict_at = datetime('now')
        WHERE id = ?`,
    ).bind(verdict, note, cleanStage, id).run();
    return true;
  } catch (e) {
    console.error('mini store: verdict failed', e);
    return false;
  }
}

/**
 * The trend queries. These are the whole reason the table exists, so they live
 * next to it rather than being re-typed into a page.
 */
export interface Trends {
  byVersion: Array<{ pipeline_version: string; runs: number; avg_premises: number; avg_cost: number; avg_ms: number; wrong: number }>;
  byDomain: Array<{ domain: string; considered: number; kept: number; keep_rate: number }>;
  byDropStage: Array<{ drop_stage: string; n: number }>;
  byTier: Array<{ tier: string; n: number }>;
  /** The rate with a denominator. Impossible before mini_claims existed. */
  claimOutcomes: Array<{ outcome: string; n: number }>;
  sourcedRate: { attempted: number; researched: number; sourced: number };
  /** Where fetching actually fails, per domain. */
  fetchOutcomes: Array<{ outcome: string; n: number; avg_ms: number }>;
  fetchByDomain: Array<{ domain: string; tries: number; ok: number; ok_rate: number }>;
  /** Which stage the owner blamed, when a run was marked wrong. */
  byVerdictStage: Array<{ verdict_stage: string; n: number }>;
}

export async function getTrends(db: MiniDb): Promise<Trends> {
  const byVersion = await db.prepare(
    `SELECT pipeline_version,
            COUNT(*) AS runs,
            ROUND(AVG(premise_count), 2) AS avg_premises,
            ROUND(AVG(cost_usd), 4) AS avg_cost,
            CAST(AVG(total_ms) AS INTEGER) AS avg_ms,
            SUM(CASE WHEN verdict = 'wrong' THEN 1 ELSE 0 END) AS wrong
       FROM mini_briefings GROUP BY pipeline_version ORDER BY pipeline_version`,
  ).bind().all<Trends['byVersion'][number]>();

  // Which publishers are worth fetching at all. A domain that is retrieved
  // often and kept rarely is a domain the retrieval step should stop chasing.
  const byDomain = await db.prepare(
    `SELECT domain,
            COUNT(*) AS considered,
            SUM(kept) AS kept,
            ROUND(CAST(SUM(kept) AS REAL) / COUNT(*), 2) AS keep_rate
       FROM mini_sources WHERE domain IS NOT NULL
       GROUP BY domain HAVING COUNT(*) >= 2 ORDER BY considered DESC LIMIT 40`,
  ).bind().all<Trends['byDomain'][number]>();

  // Which gate is doing the work. If one of them never fires, it is not earning
  // its call; if one fires on almost everything, retrieval is the problem.
  const byDropStage = await db.prepare(
    `SELECT COALESCE(drop_stage, 'kept') AS drop_stage, COUNT(*) AS n
       FROM mini_sources GROUP BY 1 ORDER BY n DESC`,
  ).bind().all<Trends['byDropStage'][number]>();

  const byTier = await db.prepare(
    `SELECT tier, COUNT(*) AS n FROM mini_briefings GROUP BY tier ORDER BY n DESC`,
  ).bind().all<Trends['byTier'][number]>();

  // The rate with a denominator. "Two premises sourced" means one thing out of
  // two claims and something very different out of five, and until mini_claims
  // existed the stored row could not tell them apart.
  const claimOutcomes = await db.prepare(
    `SELECT outcome, COUNT(*) AS n FROM mini_claims GROUP BY outcome ORDER BY n DESC`,
  ).bind().all<Trends['claimOutcomes'][number]>();

  const rate = await db.prepare(
    `SELECT COUNT(*) AS attempted,
            SUM(researched) AS researched,
            SUM(sourced) AS sourced
       FROM mini_claims`,
  ).bind().first<{ attempted: number; researched: number; sourced: number }>();

  // Whether the bottleneck is search, fetching, or reading. Three different
  // problems that all look like "the briefing is thin" from the outside.
  const fetchOutcomes = await db.prepare(
    `SELECT outcome, COUNT(*) AS n, CAST(AVG(ms) AS INTEGER) AS avg_ms
       FROM mini_fetches GROUP BY outcome ORDER BY n DESC`,
  ).bind().all<Trends['fetchOutcomes'][number]>();

  // Unlike byDomain, this counts every page the pipeline TRIED to read, not
  // just the ones a model proposed a quote from. A publisher that is fetched
  // every run and never yields anything is invisible to the other query.
  const fetchByDomain = await db.prepare(
    `SELECT domain,
            COUNT(*) AS tries,
            SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS ok,
            ROUND(CAST(SUM(CASE WHEN outcome = 'ok' THEN 1 ELSE 0 END) AS REAL) / COUNT(*), 2) AS ok_rate
       FROM mini_fetches WHERE domain IS NOT NULL
       GROUP BY domain HAVING COUNT(*) >= 2 ORDER BY tries DESC LIMIT 40`,
  ).bind().all<Trends['fetchByDomain'][number]>();

  const byVerdictStage = await db.prepare(
    `SELECT verdict_stage, COUNT(*) AS n FROM mini_briefings
      WHERE verdict_stage IS NOT NULL GROUP BY verdict_stage ORDER BY n DESC`,
  ).bind().all<Trends['byVerdictStage'][number]>();

  return {
    byVersion: byVersion.results ?? [],
    byDomain: byDomain.results ?? [],
    byDropStage: byDropStage.results ?? [],
    byTier: byTier.results ?? [],
    claimOutcomes: claimOutcomes.results ?? [],
    sourcedRate: rate ?? { attempted: 0, researched: 0, sourced: 0 },
    fetchOutcomes: fetchOutcomes.results ?? [],
    fetchByDomain: fetchByDomain.results ?? [],
    byVerdictStage: byVerdictStage.results ?? [],
  };
}

/**
 * The near-miss question, as a query.
 *
 * Every quote that failed the exact-match check, with what the model claimed it
 * said. Read thirty of these against their pages and the answer falls out: if
 * the strings are almost right, the matcher is too strict and briefings are
 * needlessly thin. If nothing like them is on the page, retrieval is broken.
 * Opposite fixes, and this is the only way to tell which one you have.
 */
export async function listDroppedQuotes(db: MiniDb, limit = 60): Promise<Array<{
  claim: string; who: string | null; domain: string | null; url: string | null;
  drop_stage: string; drop_reason: string | null; attempted_quote: string | null; created_at: string;
}>> {
  const r = await db.prepare(
    `SELECT s.claim, s.who, s.domain, s.url, s.drop_stage, s.drop_reason,
            s.attempted_quote, b.created_at
       FROM mini_sources s JOIN mini_briefings b ON b.id = s.briefing_id
      WHERE s.attempted_quote IS NOT NULL
      ORDER BY b.created_at DESC LIMIT ?`,
  ).bind(limit).all<{
    claim: string; who: string | null; domain: string | null; url: string | null;
    drop_stage: string; drop_reason: string | null; attempted_quote: string | null; created_at: string;
  }>();
  return r.results ?? [];
}
