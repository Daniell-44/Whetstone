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
      JSON.stringify({ ...b, considered: undefined }),
      b.timing.outlineMs, b.timing.totalMs, b.cost.calls, b.cost.groundedCalls,
      b.cost.inputTokens, b.cost.outputTokens, costOf(b.cost),
      b.dropped.unverified, b.dropped.offClaim,
    ).run();

    const rows: MiniSource[] = b.considered ?? [];
    for (const s of rows) {
      try {
        await db.prepare(
          `INSERT INTO mini_sources (
             briefing_id, claim, who, publication, domain, stance, kept, drop_stage, drop_reason, quote_chars, url
           ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(
          id, s.claim ?? '', s.who ?? null, s.publication ?? null,
          domainOf(s.resolvedUrl ?? s.url), s.stance ?? null,
          s.dropStage ? 0 : 1, s.dropStage ?? null,
          s.relevanceNote ?? s.verifyNote ?? null,
          s.quote ? s.quote.length : null, s.resolvedUrl ?? s.url ?? null,
        ).run();
      } catch (e) {
        console.error('mini store: source row failed', e);
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
}

export async function listMiniBriefings(db: MiniDb, limit = 100): Promise<MiniRow[]> {
  const r = await db.prepare(
    `SELECT id, created_at, trigger, depth, pipeline_version, url, title, tier,
            question, conclusion, claim_count, premise_count, total_ms, outline_ms,
            cost_usd, dropped_unverified, dropped_off_claim, verdict, verdict_note
       FROM mini_briefings ORDER BY created_at DESC LIMIT ?`,
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

export async function setVerdict(db: MiniDb, id: string, verdict: string, note: string | null): Promise<boolean> {
  if (!/^[a-z0-9]{1,20}$/.test(id)) return false;
  if (!['right', 'wrong', 'mixed'].includes(verdict)) return false;
  try {
    await db.prepare(
      `UPDATE mini_briefings SET verdict = ?, verdict_note = ?, verdict_at = datetime('now') WHERE id = ?`,
    ).bind(verdict, note, id).run();
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

  return {
    byVersion: byVersion.results ?? [],
    byDomain: byDomain.results ?? [],
    byDropStage: byDropStage.results ?? [],
    byTier: byTier.results ?? [],
  };
}
