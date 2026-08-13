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
 * Three tiers, tried in order, and it stops at the first one that produces
 * something verified:
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
 */
import { retrievePremise, fetchPages, squeeze, type GroundedSource, type FetchedPage } from './grounded';
import type { LlmProvider } from '../providers/types';

export type MiniTier = 'premises' | 'contrast' | 'single' | 'none';

export interface MiniPremise {
  claim: string;
  /** Why it carries weight in THIS argument. */
  load: string;
  sources: GroundedSource[];
}

export interface MiniBriefing {
  tier: MiniTier;
  question: string;
  premises: MiniPremise[];
  /** Populated on the contrast and single tiers. */
  opposing: GroundedSource[];
  /** What the reader should know about how thin this is. Always populated. */
  limits: string[];
  cost: { calls: number; groundedCalls: number; inputTokens: number; outputTokens: number; ms: number };
}

export interface MiniDeps {
  provider: LlmProvider;
  apiKey: string;
  model?: string;
  /** How many premises to research. Each one costs a grounded call. */
  maxPremises?: number;
}

const EXTRACT_SYSTEM = `You read one article and name the claims its argument rests on.

A load-bearing claim is one where, if it turned out to be false, the article's
conclusion would not follow. Ignore colour, background, and anything the piece
mentions but does not lean on.

Prefer claims that are CONTESTABLE IN PUBLIC: a number, a causal claim, a
comparison, a prediction. Skip claims that are true by definition, and skip
pure value judgements, because no amount of research moves those.

Return ONLY:
{"question":"the contested question this article is answering, as a question",
 "claims":[{"claim":"the claim in one plain sentence","load":"what fails if it is false"}]}

Two to four claims. Fewer is better than padded.`;

/** Stage 1. Read the article. No searching, no recall: the text is right there. */
async function extractClaims(
  text: string,
  deps: MiniDeps,
): Promise<{ question: string; claims: { claim: string; load: string }[]; inTok: number; outTok: number }> {
  const res = await deps.provider.complete(
    {
      operation: 'analyze',
      model: deps.model ?? 'gemini-2.5-flash',
      systemInstruction: EXTRACT_SYSTEM,
      messages: [{ role: 'user', content: text.slice(0, 20_000) }],
      responseFormat: 'json',
      temperature: 0,
      thinkingBudget: 0,
      maxTokens: 1536,
    },
    deps.apiKey,
  );
  try {
    const j = JSON.parse(res.content.replace(/^```json\s*/i, '').replace(/```\s*$/, ''));
    return {
      question: typeof j.question === 'string' ? j.question : '',
      claims: Array.isArray(j.claims) ? j.claims.filter((c: unknown) => c && typeof (c as { claim?: string }).claim === 'string') : [],
      inTok: res.inputTokens,
      outTok: res.outputTokens,
    };
  } catch {
    return { question: '', claims: [], inTok: res.inputTokens, outTok: res.outputTokens };
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
): Promise<{ sources: GroundedSource[]; inTok: number; outTok: number }> {
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
        'BEAR ON the claim, agreeing or disagreeing with it. ' +
        'Copy each quote CHARACTER FOR CHARACTER from the text you were given. Do not correct, ' +
        'shorten mid-sentence, join two sentences, or tidy punctuation. Every quote will be checked ' +
        'against the page and any that does not match exactly will be deleted. ' +
        'Quote between 8 and 45 words. Use the exact URL given for that source. ' +
        'If a page says nothing that bears on the claim, skip it entirely rather than stretching. ' +
        'Return {"sources":[{"who":"person or institution","publication":"","position":"what they hold, your words","quote":"copied exactly","url":"the given URL"}]}',
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
function verifyAgainstFetched(sources: GroundedSource[], pages: FetchedPage[]): GroundedSource[] {
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

export async function buildMiniBriefing(articleText: string, deps: MiniDeps): Promise<MiniBriefing> {
  const t0 = Date.now();
  const cost = { calls: 0, groundedCalls: 0, inputTokens: 0, outputTokens: 0, ms: 0 };
  const limits: string[] = [];
  const maxPremises = deps.maxPremises ?? 2;

  // ---- stage 1: what does this rest on
  const ex = await extractClaims(articleText, deps);
  cost.calls++; cost.inputTokens += ex.inTok; cost.outputTokens += ex.outTok;

  const premises: MiniPremise[] = [];

  // ---- stage 2: who disputes each claim, retrieved and then checked
  for (const c of ex.claims.slice(0, maxPremises)) {
    const g = await retrievePremise(c.claim, deps.apiKey, deps.model ?? 'gemini-2.5-flash');
    cost.calls++; cost.groundedCalls++;
    if (!g.text) continue;

    const pages = await fetchPages(g.chunks, 5);
    const st = await quotesFromPages(c.claim, pages, deps);
    cost.calls++; cost.inputTokens += st.inTok; cost.outputTokens += st.outTok;

    const kept = verifyAgainstFetched(st.sources, pages).filter((s) => s.verified);
    if (kept.length > 0) premises.push({ claim: c.claim, load: c.load, sources: kept });
  }

  if (premises.length > 0) {
    if (premises.length < ex.claims.length) {
      limits.push(`${ex.claims.length} load-bearing claims were found; ${premises.length} could be sourced with a quote that checks out.`);
    }
    cost.ms = Date.now() - t0;
    return { tier: 'premises', question: ex.question, premises, opposing: [], limits, cost };
  }

  // ---- fall back: articles that disagree, ideally in different ways
  limits.push('No claim could be paired with a quote that survived checking, so this falls back to opposing pieces rather than premise-by-premise.');
  const target = ex.question || articleText.slice(0, 300);
  const g = await retrievePremise(
    `Which published articles disagree with this, and on what different grounds: ${target}`,
    deps.apiKey,
    deps.model ?? 'gemini-2.5-flash',
  );
  cost.calls++; cost.groundedCalls++;
  const fbPages = await fetchPages(g.chunks, 6);
  const st = await quotesFromPages(target, fbPages, deps);
  cost.calls++; cost.inputTokens += st.inTok; cost.outputTokens += st.outTok;
  const opposing = verifyAgainstFetched(st.sources, fbPages).filter((s) => s.verified);

  cost.ms = Date.now() - t0;
  if (opposing.length >= 2) {
    return { tier: 'contrast', question: ex.question, premises: [], opposing: opposing.slice(0, 2), limits, cost };
  }
  if (opposing.length === 1) {
    limits.push('Only one opposing piece could be verified. Treat this as a pointer, not a survey.');
    return { tier: 'single', question: ex.question, premises: [], opposing, limits, cost };
  }
  limits.push('Nothing could be verified against a source. Better to show nothing than to show a quote we cannot stand behind.');
  return { tier: 'none', question: ex.question, premises: [], opposing: [], limits, cost };
}
