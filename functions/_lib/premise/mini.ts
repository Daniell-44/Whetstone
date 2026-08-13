/**
 * THE MINI-BRIEFING, ON COMMAND.
 *
 * Daniel, 2026-08-13: "the mini breifining on command with research of
 * alternating persectives and sicourse contested premisis has to be live. if
 * not premis possible than just contrsating articles (start with two if
 * feasible with diff areas of disagreement), else go with one."
 *
 * So this does NOT depend on a corpus, a cache, a crawler or reuse across
 * users. Every call stands alone. That is the whole point: it has to work on
 * the first article the first user ever opens.
 *
 * Three tiers, tried in order, stopping at the first that produces something
 * verified:
 *
 *   PREMISES  the article's load-bearing claims, each with who disputes it and
 *             a quote that survived being checked against the source page.
 *   CONTRAST  two articles that disagree with this one in DIFFERENT ways, so
 *             the reader gets two distinct lines of attack rather than the same
 *             objection twice.
 *   SINGLE    one opposing article. Thin, honest, still better than nothing.
 *
 * Stage 1 is ungrounded ON PURPOSE. Pulling the claims out of the text in front
 * of it is reading, not recall, and it is the one thing a model does reliably.
 * Stage 2 is grounded, because who-disputes-this is exactly the recall question
 * that produced fabricated quotes and invented URLs when asked cold.
 *
 * TWO THINGS THIS FILE EXISTS TO GET RIGHT, both from measured failures:
 *
 * 1. STAGED OUTPUT. The whole run takes tens of seconds and the outline takes
 *    about three. Making the reader stare at a spinner for the difference is a
 *    choice, not a constraint. streamMiniBriefing() yields the outline the
 *    moment it exists and then each premise as it lands, so there is something
 *    to read while the rest is still being fetched. buildMiniBriefing() drains
 *    the same generator for callers that just want the finished object.
 *
 * 2. RELEVANCE, NOT JUST TRUTH. The quote gate proves a quote is REAL. It says
 *    nothing about whether it is ABOUT the claim. A measured run kept a quote
 *    giving reactor capacity in megawatts against a claim about capacity
 *    FACTOR in per cent. Both real, both nuclear, different quantities, and the
 *    pairing was worthless. So verified quotes now face a second gate that
 *    compares subjects, and the drop rule lives in code rather than in the
 *    model's discretion.
 */
import { retrievePremise, fetchPages, squeeze, type GroundedSource, type FetchedPage } from './grounded';
import type { LlmProvider } from '../providers/types';

export type MiniTier = 'premises' | 'contrast' | 'single' | 'none';

/** Where a source stands relative to the claim. Never inferred from tone. */
export type Stance = 'contests' | 'complicates' | 'supports';

export interface MiniSource extends GroundedSource {
  stance?: Stance;
  /** Which part of the claim this quote speaks to, in the model's words. */
  addresses?: string;
  /** Why a quote was dropped for relevance, when it was. */
  relevanceNote?: string;
  /** The claim this was retrieved for. Set when the source is recorded. */
  claim?: string;
  /**
   * Which gate threw it out, when one did.
   *
   * Kept because the DROPS are the data. What survived says what the reader
   * sees; what was dropped and why says where the pipeline is weak, and that
   * is the only thing that tells you what to fix. Discarding it would leave
   * "why is this one thin" permanently unanswerable.
   */
  dropStage?: 'quote' | 'relevance';
}

export interface MiniPremise {
  claim: string;
  /** Why it carries weight in THIS argument. */
  load: string;
  sources: MiniSource[];
  /** True when nothing found actually disputes the claim. Said plainly, not hidden. */
  undisputed: boolean;
}

/**
 * What stage 1 produces, on its own, in about three seconds.
 *
 * This is the part the reader gets immediately: what the piece concludes and
 * what it needs to be true. It stands up alone even if every later stage
 * returns nothing.
 */
export interface MiniOutline {
  question: string;
  conclusion: string;
  claims: { claim: string; load: string }[];
}

export interface MiniBriefing {
  tier: MiniTier;
  question: string;
  conclusion: string;
  premises: MiniPremise[];
  /** Populated on the contrast and single tiers. */
  opposing: MiniSource[];
  /** What the reader should know about how thin this is. Always populated. */
  limits: string[];
  dropped: { unverified: number; offClaim: number };
  /**
   * Every source considered across all claims, kept and dropped alike, with the
   * gate that removed it. Not shown to a reader. This is what gets stored, and
   * it is the only thing that can answer which domains are worth fetching and
   * which gate is doing the work.
   */
  considered: MiniSource[];
  cost: { calls: number; groundedCalls: number; inputTokens: number; outputTokens: number; ms: number };
  timing: { outlineMs: number; totalMs: number };
}

/** Progress events, in the order a reader would want them. */
export type MiniEvent =
  | { type: 'outline'; outline: MiniOutline; ms: number }
  | { type: 'researching'; claims: string[] }
  | { type: 'premise'; index: number; premise: MiniPremise }
  | { type: 'premise-empty'; index: number; claim: string; why: string }
  | { type: 'done'; briefing: MiniBriefing };

/**
 * What started this run, which decides how much gets researched.
 *
 * A selection has already been pointed at: the reader picked one sentence, so
 * researching four claims spends money answering questions they did not ask.
 * A whole article has not been pointed at, and one claim there cannot show the
 * thing that matters most, which is that an argument leans on more than one
 * weak point.
 */
export type MiniTrigger = 'selection' | 'article';

/** Claims researched per trigger. Each one is a search, and search is 91% of the bill. */
const PREMISES_FOR: Record<MiniTrigger, number> = { selection: 1, article: 2 };

/**
 * The outline's thinking budget, measured rather than guessed.
 *
 * scripts/bench-outline.ts, nine runs per setting across three articles:
 *
 *   budget    secs   claims  checkable   quality per claim      cost
 *        0     2.4      2.7        1.3                0.72   $0.00071
 *      512     4.7      3.0        1.7                0.89   $0.00079   <-
 *     2048     8.0      3.3        1.8                0.82   $0.00088
 *     8192     9.4      3.3        1.7                0.75   $0.00085
 *
 * Quality peaks at 512 and falls after it: past that the model writes MORE
 * claims, and the extra ones are vaguer, which costs a real search each
 * downstream. Cost never chooses here, since the whole range is about one per
 * cent of a run. The only currency at this stage is the reader's seconds, and
 * 512 buys the entire available gain for the smallest number of them.
 */
const OUTLINE_THINKING = 512;

export interface MiniDeps {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
  /** What started the run. Sets the premise count unless maxPremises overrides it. */
  trigger?: MiniTrigger;
  /** How many premises to research. Each one costs a grounded call. */
  maxPremises?: number;
  /** Sources shown per premise, after ordering puts dispute first. */
  maxSourcesPerPremise?: number;
  /**
   * Thinking budget for the outline call. Defaults to the measured optimum
   * above. Present so the benchmark can sweep it, not so callers can tune it.
   */
  outlineThinking?: number;
}

const EXTRACT_SYSTEM = `You read one article and name what its argument rests on.

A load-bearing claim is one where, if it turned out to be false, the article's
conclusion would not follow. Ignore colour, background, and anything the piece
mentions but does not lean on.

Prefer claims that are CONTESTABLE IN PUBLIC: a number, a causal claim, a
comparison, a prediction. Skip claims that are true by definition, and skip
pure value judgements, because no amount of research moves those.

Write each claim so it stands alone, with its subject and its units named. Not
"the cost is lower" but "a nuclear-inclusive grid costs 25 per cent less than a
renewables-only grid". Someone who has not read the article must be able to go
and check it.

Return ONLY:
{"question":"the contested question this article is answering, as a question",
 "conclusion":"what this article concludes, in one sentence, in its own terms",
 "claims":[{"claim":"the claim in one plain sentence","load":"what fails if it is false"}]}

Two to four claims. Fewer is better than padded.`;

/**
 * Stage 1. Read the article. No searching, no recall: the text is right there.
 *
 * Exported so the thinking budget can be benchmarked against outline quality.
 * This is the one call the reader waits on, so what it costs in seconds is the
 * only latency that is actually felt.
 */
export async function extractOutline(
  text: string,
  deps: MiniDeps,
): Promise<{ outline: MiniOutline; inTok: number; outTok: number }> {
  const res = await deps.provider.complete(
    {
      operation: 'analyze',
      model: deps.model ?? 'gemini-2.5-flash',
      systemInstruction: EXTRACT_SYSTEM,
      messages: [{ role: 'user', content: text.slice(0, 20_000) }],
      responseFormat: 'json',
      temperature: 0,
      thinkingBudget: deps.outlineThinking ?? OUTLINE_THINKING,
      // Thinking draws from THIS budget, not a separate one. Leaving it at a
      // flat 1536 meant that asking for 2048 tokens of thinking spent the whole
      // allowance before a single character of JSON was written, and the answer
      // came back truncated with no conclusion and one claim. That looked
      // exactly like "more thinking makes it worse" in a benchmark, which is
      // the wrong lesson drawn from a real bug. The answer needs its own room.
      maxTokens: 1536 + (deps.outlineThinking ?? 0),
    },
    deps.apiKey,
  );
  const empty: MiniOutline = { question: '', conclusion: '', claims: [] };
  try {
    const j = JSON.parse(res.content.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    return {
      outline: {
        question: typeof j.question === 'string' ? j.question : '',
        conclusion: typeof j.conclusion === 'string' ? j.conclusion : '',
        claims: Array.isArray(j.claims)
          ? j.claims
              .filter((c: unknown) => c && typeof (c as { claim?: string }).claim === 'string')
              .map((c: { claim: string; load?: string }) => ({ claim: c.claim, load: c.load ?? '' }))
          : [],
      },
      inTok: res.inputTokens,
      outTok: res.outputTokens,
    };
  } catch {
    return { outline: empty, inTok: res.inputTokens, outTok: res.outputTokens };
  }
}

/**
 * Pull quotes out of the ACTUAL page text, one call across all fetched pages.
 *
 * Replaces an earlier version that asked the model to structure its own
 * research note. That version verified zero sources on every run, because the
 * grounded model writes prose about a debate rather than quotations from it,
 * so there was never an exact string to check. Handing it the real page text
 * and asking it to copy from that is a reading task, and it is the same thing
 * a person would do.
 */
async function quotesFromPages(
  claim: string,
  pages: FetchedPage[],
  deps: MiniDeps,
): Promise<{ sources: MiniSource[]; inTok: number; outTok: number }> {
  if (pages.length === 0) return { sources: [], inTok: 0, outTok: 0 };

  // Cap per page so a long page cannot crowd the others out of the window.
  const corpus = pages
    .map((p, i) => `--- SOURCE ${i + 1}\nURL: ${p.resolvedUrl}\nTITLE: ${p.title ?? ''}\nTEXT: ${p.text.slice(0, 6000)}`)
    .join('\n\n');

  const res = await deps.provider.complete(
    {
      operation: 'synthesize',
      model: deps.model ?? 'gemini-2.5-flash',
      systemInstruction:
        'You are given a claim and the text of several web pages. Find passages in that text that ' +
        'BEAR ON the claim, agreeing or disagreeing with it. Prefer passages that DISAGREE: the ' +
        'reader can already see the case for the claim in the article they are reading. ' +
        'A passage bears on the claim only if it is about the SAME QUANTITY, the SAME PLACE and ' +
        'the SAME PERIOD. A passage about a related but different measure does not count. Capacity ' +
        'measured in megawatts is not capacity factor measured in per cent; cost per unit is not ' +
        'total cost; one country is not another. If in doubt, leave it out. ' +
        'Copy each quote CHARACTER FOR CHARACTER from the text you were given. Do not correct, ' +
        'shorten mid-sentence, join two sentences, or tidy punctuation. Every quote will be checked ' +
        'against the page and any that does not match exactly will be deleted. ' +
        'Quote between 8 and 45 words. Use the exact URL given for that source. ' +
        'If a page says nothing that bears on the claim, skip it entirely rather than stretching. ' +
        'Return {"sources":[{"who":"person or institution","publication":"","position":"what they hold, ' +
        'your words","stance":"contests"|"complicates"|"supports","addresses":"the exact part of the ' +
        'claim this speaks to","quote":"copied exactly","url":"the given URL"}]}',
      messages: [{ role: 'user', content: `CLAIM: ${claim}\n\n${corpus}` }],
      responseFormat: 'json',
      temperature: 0,
      thinkingBudget: 0,
      maxTokens: 2048,
    },
    deps.apiKey,
  );
  try {
    const j = JSON.parse(res.content.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    return { sources: Array.isArray(j.sources) ? j.sources : [], inTok: res.inputTokens, outTok: res.outputTokens };
  } catch {
    return { sources: [], inTok: res.inputTokens, outTok: res.outputTokens };
  }
}

/**
 * Check quotes against the page text we already downloaded.
 *
 * Cheaper and stricter than re-fetching: the text is in hand, so a mismatch is
 * unambiguous rather than possibly a second fetch returning different markup.
 */
export function verifyAgainstFetched(sources: MiniSource[], pages: FetchedPage[]): MiniSource[] {
  const byUrl = new Map(pages.map((p) => [p.resolvedUrl, squeeze(p.text)]));
  return sources.map((s) => {
    if (!s.quote || !s.url) return { ...s, verified: false, verifyNote: 'no quote or url' };
    const hay = byUrl.get(s.url) ?? [...byUrl.values()].find((t) => t.includes(squeeze(s.quote!)));
    const needle = squeeze(s.quote).replace(/^["']|["']$/g, '');
    if (needle.length < 24) return { ...s, quote: undefined, verified: false, verifyNote: 'quote too short to be evidence' };
    if (hay && hay.includes(needle)) return { ...s, resolvedUrl: s.url, verified: true };
    return { ...s, quote: undefined, verified: false, verifyNote: 'wording not found in the fetched page' };
  });
}

/**
 * THE RELEVANCE GATE.
 *
 * The quote gate answers "is this real". This answers "is this about the
 * claim", which is a different question and the one that was going unasked.
 *
 * The model is not asked for a verdict it can hedge. It is asked to name the
 * subject of the claim and the subject of the quote separately, and to say
 * whether they are the same thing. Splitting it that way makes the comparison
 * explicit rather than a feeling about topical closeness, and it leaves the
 * DROP RULE in code below, where it can be tested without a network call.
 */
export interface RelevanceVerdict {
  index: number;
  claimSubject: string;
  quoteSubject: string;
  sameSubject: boolean;
  why: string;
}

const RELEVANCE_SYSTEM = `You are checking whether a quote is ABOUT a claim. Not whether it is true,
not whether it is interesting, not whether it comes from a good source. Only whether the two are
about the same thing.

For each numbered quote, name three things:
  claimSubject  what the claim measures or asserts, including its quantity, unit, place and period
  quoteSubject  what the quote measures or asserts, in the same terms
  sameSubject   true only if a reader checking the claim would accept this quote as bearing on it

These are DIFFERENT subjects and sameSubject must be false:
  capacity in megawatts vs capacity factor in per cent
  cost per megawatt hour vs total programme cost
  one country's figures vs another country's
  a projection for 2040 vs a measurement from 2020
  the technology in general vs the specific project claimed

A quote that DISAGREES with the claim is still about it. Disagreement is not irrelevance.
A quote that merely mentions the same industry, fuel or company is NOT about the claim.

Return ONLY {"verdicts":[{"index":0,"claimSubject":"...","quoteSubject":"...","sameSubject":true,"why":"one short sentence"}]}
One verdict per quote given, in the same order.`;

async function judgeRelevance(
  claim: string,
  sources: MiniSource[],
  deps: MiniDeps,
): Promise<{ verdicts: RelevanceVerdict[]; inTok: number; outTok: number }> {
  if (sources.length === 0) return { verdicts: [], inTok: 0, outTok: 0 };
  const listed = sources
    .map((s, i) => `${i}. [${s.who}${s.publication ? ' / ' + s.publication : ''}] "${s.quote}"`)
    .join('\n\n');

  const res = await deps.provider.complete(
    {
      operation: 'analyze',
      model: deps.model ?? 'gemini-2.5-flash',
      systemInstruction: RELEVANCE_SYSTEM,
      messages: [{ role: 'user', content: `CLAIM: ${claim}\n\nQUOTES:\n${listed}` }],
      responseFormat: 'json',
      temperature: 0,
      thinkingBudget: 0,
      maxTokens: 1536,
    },
    deps.apiKey,
  );
  try {
    const j = JSON.parse(res.content.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    const verdicts: RelevanceVerdict[] = Array.isArray(j.verdicts)
      ? j.verdicts.map((v: Partial<RelevanceVerdict>, i: number) => ({
          index: typeof v.index === 'number' ? v.index : i,
          claimSubject: String(v.claimSubject ?? ''),
          quoteSubject: String(v.quoteSubject ?? ''),
          sameSubject: v.sameSubject === true,
          why: String(v.why ?? ''),
        }))
      : [];
    return { verdicts, inTok: res.inputTokens, outTok: res.outputTokens };
  } catch {
    return { verdicts: [], inTok: res.inputTokens, outTok: res.outputTokens };
  }
}

/**
 * Apply the verdicts. Kept separate and exported so the rule is testable
 * without a model: a source survives only if a verdict exists for it AND says
 * the subjects match. A missing verdict drops the source. Silence is not
 * consent when the alternative is showing a reader an irrelevant quote.
 */
export function applyRelevance(sources: MiniSource[], verdicts: RelevanceVerdict[]): MiniSource[] {
  const byIndex = new Map(verdicts.map((v) => [v.index, v]));
  return sources.map((s, i) => {
    const v = byIndex.get(i);
    if (!v) return { ...s, quote: undefined, verified: false, relevanceNote: 'no relevance verdict returned' };
    if (v.sameSubject) return s;
    return {
      ...s,
      quote: undefined,
      verified: false,
      relevanceNote: `about ${v.quoteSubject || 'something else'}, not ${v.claimSubject || 'this claim'}`,
    };
  });
}

/**
 * Dispute first, then the awkward middle, then agreement.
 *
 * The reader arrived holding the article's case. Repeating it back is the one
 * thing that adds nothing, so the objection goes at the top and the supporting
 * quote goes last or gets cut. Stable within each band, so retrieval order
 * still breaks ties.
 */
const STANCE_RANK: Record<Stance, number> = { contests: 0, complicates: 1, supports: 2 };

export function orderByDispute(sources: MiniSource[]): MiniSource[] {
  return sources
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const ra = STANCE_RANK[a.s.stance ?? 'supports'] ?? 2;
      const rb = STANCE_RANK[b.s.stance ?? 'supports'] ?? 2;
      return ra === rb ? a.i - b.i : ra - rb;
    })
    .map(({ s }) => s);
}

interface PremiseResult {
  index: number;
  premise: MiniPremise | null;
  why: string;
  inTok: number;
  outTok: number;
  calls: number;
  groundedCalls: number;
  droppedUnverified: number;
  droppedOffClaim: number;
  /** Every source this claim considered, kept and dropped alike. */
  considered: MiniSource[];
}

/** One claim, end to end: search, fetch, quote, verify, check relevance, order. */
async function researchPremise(
  c: { claim: string; load: string },
  index: number,
  deps: MiniDeps,
): Promise<PremiseResult> {
  const base: PremiseResult = {
    index, premise: null, why: '', inTok: 0, outTok: 0,
    calls: 0, groundedCalls: 0, droppedUnverified: 0, droppedOffClaim: 0, considered: [],
  };
  const stamp = (s: MiniSource, dropStage?: 'quote' | 'relevance'): MiniSource =>
    ({ ...s, claim: c.claim, ...(dropStage ? { dropStage } : {}) });
  try {
    const g = await retrievePremise(c.claim, deps.apiKey, deps.model ?? 'gemini-2.5-flash', 'dispute');
    base.calls++; base.groundedCalls++;
    if (!g.text) return { ...base, why: 'search returned nothing' };

    const pages = await fetchPages(g.chunks, 5);
    if (pages.length === 0) return { ...base, why: 'no source page could be fetched' };

    const st = await quotesFromPages(c.claim, pages, deps);
    base.calls++; base.inTok += st.inTok; base.outTok += st.outTok;

    const checked = verifyAgainstFetched(st.sources, pages);
    const real = checked.filter((s) => s.verified);
    const failedQuote = checked.filter((s) => !s.verified).map((s) => stamp(s, 'quote'));
    base.droppedUnverified = failedQuote.length;
    base.considered = failedQuote;
    if (real.length === 0) return { ...base, why: 'no quote survived checking against its page' };

    // Second gate: real is not the same as relevant.
    const rel = await judgeRelevance(c.claim, real, deps);
    base.calls++; base.inTok += rel.inTok; base.outTok += rel.outTok;
    const judged = applyRelevance(real, rel.verdicts);
    const kept = judged.filter((s) => s.verified);
    const failedRelevance = judged.filter((s) => !s.verified).map((s) => stamp(s, 'relevance'));
    base.droppedOffClaim = failedRelevance.length;
    base.considered = [...kept.map((s) => stamp(s)), ...failedRelevance, ...failedQuote];
    if (kept.length === 0) return { ...base, why: 'quotes were real but about a different quantity' };

    const ordered = orderByDispute(kept).slice(0, deps.maxSourcesPerPremise ?? 3);
    return {
      ...base,
      premise: {
        claim: c.claim,
        load: c.load,
        sources: ordered,
        undisputed: !ordered.some((s) => s.stance === 'contests' || s.stance === 'complicates'),
      },
    };
  } catch (e) {
    return { ...base, why: `failed: ${(e as Error).message.slice(0, 80)}` };
  }
}

/**
 * The staged run. Yields the outline first, then each premise as it lands.
 *
 * Premises run CONCURRENTLY. They were sequential, which meant two premises
 * cost two full search-fetch-read chains back to back for no reason: they
 * share nothing and neither depends on the other's result.
 */
export async function* streamMiniBriefing(articleText: string, deps: MiniDeps): AsyncGenerator<MiniEvent> {
  const t0 = Date.now();
  const cost = { calls: 0, groundedCalls: 0, inputTokens: 0, outputTokens: 0, ms: 0 };
  const dropped = { unverified: 0, offClaim: 0 };
  const considered: MiniSource[] = [];
  const limits: string[] = [];
  const maxPremises = deps.maxPremises ?? PREMISES_FOR[deps.trigger ?? 'article'];

  // ---- stage 1: what does this conclude, and what does it rest on
  const ex = await extractOutline(articleText, deps);
  cost.calls++; cost.inputTokens += ex.inTok; cost.outputTokens += ex.outTok;
  const outlineMs = Date.now() - t0;
  yield { type: 'outline', outline: ex.outline, ms: outlineMs };

  const targets = ex.outline.claims.slice(0, maxPremises);
  const premises: MiniPremise[] = [];

  if (targets.length > 0) {
    yield { type: 'researching', claims: targets.map((c) => c.claim) };

    // ---- stage 2: who disputes each claim, retrieved, checked, then judged
    const jobs = new Map(targets.map((c, i) => [i, researchPremise(c, i, deps)]));
    while (jobs.size > 0) {
      const r = await Promise.race(jobs.values());
      jobs.delete(r.index);
      cost.calls += r.calls; cost.groundedCalls += r.groundedCalls;
      cost.inputTokens += r.inTok; cost.outputTokens += r.outTok;
      dropped.unverified += r.droppedUnverified; dropped.offClaim += r.droppedOffClaim;
      considered.push(...r.considered);
      if (r.premise) {
        premises.push(r.premise);
        yield { type: 'premise', index: r.index, premise: r.premise };
      } else {
        yield { type: 'premise-empty', index: r.index, claim: targets[r.index].claim, why: r.why };
      }
    }
    // Restore the article's own order: they finish out of order, they read in order.
    premises.sort((a, b) => targets.findIndex((t) => t.claim === a.claim) - targets.findIndex((t) => t.claim === b.claim));
  }

  if (premises.length > 0) {
    if (premises.length < targets.length) {
      limits.push(`${targets.length} load-bearing claims were checked; ${premises.length} could be sourced with a quote that is both real and about the claim.`);
    }
    if (dropped.offClaim > 0) {
      limits.push(`${dropped.offClaim} verified quote${dropped.offClaim === 1 ? ' was' : 's were'} dropped for being about a different quantity than the claim.`);
    }
    // Say which way round it is. An earlier version of this line read "1 of
    // these claims drew a published objection" for the claim that drew NONE,
    // which told the reader the opposite of the truth about the one thing they
    // most need to read correctly.
    const undisputed = premises.filter((p) => p.undisputed).length;
    if (undisputed > 0) {
      const all = undisputed === premises.length;
      const sentence =
        all && premises.length === 1 ? 'This claim drew no published objection.'
        : all ? 'No claim here drew a published objection.'
        : `${undisputed === 1 ? 'One' : undisputed} of these claims drew no published objection.`;
      limits.push(`${sentence} Nothing found against a claim is not agreement with it; it may only mean nobody has written the objection down somewhere this could reach.`);
    }
    cost.ms = Date.now() - t0;
    yield {
      type: 'done',
      briefing: {
        tier: 'premises', question: ex.outline.question, conclusion: ex.outline.conclusion,
        premises, opposing: [], limits, dropped, cost, considered,
        timing: { outlineMs, totalMs: cost.ms },
      },
    };
    return;
  }

  // ---- fall back: articles that disagree, ideally in different ways
  limits.push('No claim could be paired with a quote that both checks out and is about that claim, so this falls back to opposing pieces rather than premise by premise.');
  const target = ex.outline.question || articleText.slice(0, 300);
  const g = await retrievePremise(
    `Which published articles disagree with this, and on what different grounds: ${target}`,
    deps.apiKey,
    deps.model ?? 'gemini-2.5-flash',
  );
  cost.calls++; cost.groundedCalls++;
  const fbPages = await fetchPages(g.chunks, 6);
  const st = await quotesFromPages(target, fbPages, deps);
  cost.calls++; cost.inputTokens += st.inTok; cost.outputTokens += st.outTok;
  const fbChecked = verifyAgainstFetched(st.sources, fbPages);
  const opposing = orderByDispute(fbChecked.filter((s) => s.verified));
  considered.push(
    ...fbChecked.map((s) => ({ ...s, claim: target, ...(s.verified ? {} : { dropStage: 'quote' as const }) })),
  );
  dropped.unverified += fbChecked.length - opposing.length;

  cost.ms = Date.now() - t0;
  const timing = { outlineMs, totalMs: cost.ms };
  const head = { question: ex.outline.question, conclusion: ex.outline.conclusion, premises: [], dropped, cost, timing, considered };

  if (opposing.length >= 2) {
    yield { type: 'done', briefing: { tier: 'contrast', ...head, opposing: opposing.slice(0, 2), limits } };
    return;
  }
  if (opposing.length === 1) {
    limits.push('Only one opposing piece could be verified. Treat this as a pointer, not a survey.');
    yield { type: 'done', briefing: { tier: 'single', ...head, opposing, limits } };
    return;
  }
  limits.push('Nothing could be verified against a source. Better to show nothing than to show a quote we cannot stand behind.');
  yield { type: 'done', briefing: { tier: 'none', ...head, opposing: [], limits } };
}

/** Drain the stream for callers that only want the finished object. */
export async function buildMiniBriefing(articleText: string, deps: MiniDeps): Promise<MiniBriefing> {
  let last: MiniBriefing | null = null;
  for await (const ev of streamMiniBriefing(articleText, deps)) {
    if (ev.type === 'done') last = ev.briefing;
  }
  if (!last) throw new Error('mini-briefing produced no result');
  return last;
}
