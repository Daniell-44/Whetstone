/**
 * PUBLISHING A READER'S QUESTION.
 *
 * Daniel, 2026-08-17: "you can make these into user generated briefings which
 * can sit in the home page with a tag saying so. these wont have opinion
 * pieces attatched to the end of them."
 *
 * So a mini-briefing run can become a page on this site. Three decisions are
 * encoded here rather than left to whoever writes the next caller.
 *
 * 1. PUBLICATION IS AN ACT, NOT A DEFAULT. Nothing publishes itself. A run is
 *    stored the moment it finishes and stays private until the owner presses
 *    publish. The alternative, auto-publishing every run that clears a
 *    threshold, puts unreviewed machine output on the front door of a
 *    publication whose entire claim is that it checks things. The plumbing is
 *    identical either way, so this stays the strict option until Daniel says
 *    otherwise.
 *
 * 2. THERE IS A FLOOR, AND IT IS ABOUT EVIDENCE, NOT LENGTH. A run can only be
 *    published if at least one claim carries a quote that survived both gates.
 *    A briefing with no verified quote is the engine saying "I could not check
 *    this", and putting that on the home page next to hand-authored work would
 *    borrow credibility the run did not earn.
 *
 * 3. WHAT IS PUBLISHED IS WHAT WAS SHOWN. The stored payload is rendered
 *    as-is, through the same component the live box uses. No re-running, no
 *    tidying, no second model pass. If a published page could differ from the
 *    run it claims to be, the archive is worthless as a record.
 *
 * These pages carry NO editor's view and NO opinion piece, by Daniel's
 * instruction above. That absence is stated on the page itself: a reader who
 * has seen the hand-authored briefings will notice the missing section, and
 * silence would read as an omission rather than a rule.
 */
import type { ClientMiniBriefing } from './mini';
import type { MiniDb, MiniRow } from './store';

/**
 * Why a run may or may not be published, in code so it is testable and so the
 * admin page and the endpoint cannot disagree about it.
 */
export interface Publishability {
  ok: boolean;
  /** Plain-language reason, shown in the admin list. Empty when ok. */
  reason: string;
  /** Quotes that passed both gates. The number the floor is about. */
  verifiedQuotes: number;
}

/**
 * Quotes that survived BOTH gates: matched their page character for character
 * AND were judged to be about the claim.
 *
 * Both flags are required. A source whose quote was nulled by a gate is not
 * evidence, whatever its verified flag still says, and counting it would put a
 * number on the card that the page cannot show.
 */
export function countVerifiedQuotes(b: Pick<ClientMiniBriefing, 'premises' | 'opposing'>): number {
  return b.premises.reduce((n, p) => n + p.sources.filter((s) => s.verified && s.quote).length, 0)
    + b.opposing.filter((s) => s.verified && s.quote).length;
}

export function publishability(b: Pick<ClientMiniBriefing, 'tier' | 'question' | 'premises' | 'opposing'>): Publishability {
  const verifiedQuotes = countVerifiedQuotes(b);

  if (!b.question?.trim()) {
    return { ok: false, reason: 'no question was identified', verifiedQuotes };
  }
  if (verifiedQuotes === 0) {
    // The floor. The engine found nothing it could stand behind, and saying so
    // privately is honest; saying it on the home page is just noise.
    return { ok: false, reason: 'no quote survived both gates', verifiedQuotes };
  }
  if (b.tier === 'none') {
    return { ok: false, reason: 'nothing could be verified', verifiedQuotes };
  }
  return { ok: true, reason: '', verifiedQuotes };
}

/**
 * A readable, stable address for a published question.
 *
 * The run id is appended rather than relying on the question text alone: two
 * visitors asking the same thing is the expected case, not the edge case, and
 * a slug collision that silently overwrote the earlier page would lose a
 * record this file exists to keep.
 */
export function questionSlug(question: string, id: string): string {
  const stem = question
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .reduce<string[]>((acc, word) => {
      if (!word) return acc;
      const joined = [...acc, word].join('-');
      return joined.length <= 60 ? [...acc, word] : acc;
    }, [])
    .join('-');
  const suffix = id.slice(0, 6);
  return stem ? `${stem}-${suffix}` : `question-${suffix}`;
}

export interface PublishedQuestion {
  id: string;
  slug: string;
  question: string;
  conclusion: string | null;
  publishedAt: string;
  createdAt: string;
  premiseCount: number;
  /**
   * Quotes that survived both gates. The number a card leads with, because it
   * is the only one that says how much of this was actually checked.
   *
   * The list query supplies it from a COUNT rather than shipping every card's
   * payload to a feed page; the single-item query counts it off the payload it
   * already has. Same number, two cheap routes to it.
   */
  verifiedQuotes: number;
  /**
   * Parsed payload. Null on the LIST path, which deliberately does not fetch
   * it, and on the single-item path only when the stored JSON is unreadable.
   * Anything rendering the briefing body must handle null.
   */
  briefing: ClientMiniBriefing | null;
}

type PublishedRow = MiniRow & { slug: string; published_at: string; payload?: string };

function toPublished(r: PublishedRow): PublishedQuestion {
  let briefing: ClientMiniBriefing | null = null;
  if (r.payload) {
    try { briefing = JSON.parse(r.payload) as ClientMiniBriefing; } catch { /* keep null */ }
  }
  return {
    id: r.id, slug: r.slug, question: r.question ?? '', conclusion: r.conclusion,
    publishedAt: r.published_at, createdAt: r.created_at,
    premiseCount: r.premise_count,
    verifiedQuotes: r.kept_sources ?? (briefing ? countVerifiedQuotes(briefing) : 0),
    briefing,
  };
}

/**
 * Publish one run. Returns the slug, or null if it was refused.
 *
 * The eligibility check runs HERE against the stored payload, not against
 * whatever the caller believes: an admin page reading a stale list must not be
 * able to publish a run that does not clear the floor.
 */
export async function publishMiniBriefing(db: MiniDb, id: string): Promise<{ ok: boolean; slug?: string; reason?: string }> {
  if (!/^[a-z0-9]{1,20}$/.test(id)) return { ok: false, reason: 'unknown run' };
  try {
    const row = await db.prepare(
      `SELECT id, question, payload, slug FROM mini_briefings WHERE id = ?`,
    ).bind(id).first<{ id: string; question: string | null; payload: string; slug: string | null }>();
    if (!row) return { ok: false, reason: 'unknown run' };

    // Already published: return the existing address rather than minting a
    // second one for the same run.
    if (row.slug) return { ok: true, slug: row.slug };

    let briefing: ClientMiniBriefing;
    try {
      briefing = JSON.parse(row.payload) as ClientMiniBriefing;
    } catch {
      return { ok: false, reason: 'the stored run could not be read' };
    }

    const check = publishability(briefing);
    if (!check.ok) return { ok: false, reason: check.reason };

    const slug = questionSlug(briefing.question || row.question || '', id);
    await db.prepare(
      `UPDATE mini_briefings
          SET published = 1, slug = ?, published_at = datetime('now')
        WHERE id = ?`,
    ).bind(slug, id).run();
    return { ok: true, slug };
  } catch (e) {
    console.error('mini publish: failed', e);
    return { ok: false, reason: 'the database refused the change' };
  }
}

/**
 * Take a published question back down.
 *
 * The slug is KEPT. A page that was public may have been linked, and an
 * unpublish that also freed the address would let a later run land on someone
 * else's URL.
 */
export async function unpublishMiniBriefing(db: MiniDb, id: string): Promise<boolean> {
  if (!/^[a-z0-9]{1,20}$/.test(id)) return false;
  try {
    await db.prepare(`UPDATE mini_briefings SET published = 0 WHERE id = ?`).bind(id).run();
    return true;
  } catch (e) {
    console.error('mini publish: unpublish failed', e);
    return false;
  }
}

/** The home-page shelf and the index page. Newest first. */
export async function listPublishedQuestions(db: MiniDb, limit = 24): Promise<PublishedQuestion[]> {
  try {
    // No `payload` here on purpose: a feed of twenty cards has no use for
    // twenty full briefings, and kept_sources answers the only question a card
    // asks of them. The single-item query below fetches the payload.
    const r = await db.prepare(
      `SELECT b.id, b.created_at, b.question, b.conclusion, b.premise_count,
              b.slug, b.published_at,
              (SELECT COUNT(*) FROM mini_sources s WHERE s.briefing_id = b.id AND s.kept = 1) AS kept_sources
         FROM mini_briefings b
        WHERE b.published = 1 AND b.slug IS NOT NULL
        ORDER BY b.published_at DESC LIMIT ?`,
    ).bind(limit).all<PublishedRow>();
    return (r.results ?? []).map(toPublished);
  } catch (e) {
    // A published shelf that throws must not take the home page with it.
    console.error('mini publish: list failed', e);
    return [];
  }
}

export async function getPublishedQuestion(db: MiniDb, slug: string): Promise<PublishedQuestion | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  try {
    const row = await db.prepare(
      `SELECT * FROM mini_briefings WHERE slug = ? AND published = 1`,
    ).bind(slug).first<PublishedRow>();
    return row ? toPublished(row) : null;
  } catch (e) {
    console.error('mini publish: fetch failed', e);
    return null;
  }
}
