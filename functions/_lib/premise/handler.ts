/**
 * The mini-briefing endpoint the extension calls.
 *
 * TWO REQUESTS, NOT A STREAM. The outline takes about five seconds and the
 * sourcing takes about thirty-five. The obvious way to deliver that is a
 * streaming response, and it is the wrong first move: nothing on this site has
 * ever streamed, the Cloudflare adapter's buffering behaviour is unverified,
 * and the extension has no code to consume a stream. That is three unproven
 * layers stacked before the first measurement.
 *
 * So: depth 'outline' returns what the reader can start on, and depth 'full'
 * returns everything. Two plain POSTs give the staged reveal with no new
 * transport on either side. If measurement later shows the second request is
 * the bottleneck, streaming can replace it knowing what it is buying.
 *
 * Every run is stored. See store.ts for why the DROPS are stored too.
 */
import { extractOutline, buildMiniBriefing, type MiniOutline, type MiniBriefing, type MiniTrigger } from './mini';
import { saveMiniBriefing, newMiniId, type MiniDb } from './store';
import { checkAndIncrementQuota, type RateLimitKV } from '../rate-limit';
import type { LlmProvider } from '../providers/types';

export const MIN_INPUT_CHARS = 180;
export const MAX_INPUT_CHARS = 40_000;

export interface MiniHandlerDeps {
  provider: LlmProvider;
  geminiApiKey: string | undefined;
  model?: string;
  rateLimitKv?: RateLimitKV;
  db?: MiniDb;
  dailyCap: number;
  userDailyCap: number;
  getSession: (req: Request) => Promise<{ userId: string } | null>;
  /** Injected so tests do not sleep through a real run. */
  runOutline?: typeof extractOutline;
  runFull?: typeof buildMiniBriefing;
  /** Fire-and-forget hook so storing does not delay the response. */
  waitUntil?: (p: Promise<unknown>) => void;
}

export type MiniResponse =
  | { ok: true; depth: 'outline'; id: string | null; outline: MiniOutline; ms: number }
  | { ok: true; depth: 'full'; id: string | null; briefing: MiniBriefing }
  | { ok: false; error: { code: string; message: string } };

function json(body: MiniResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function clientKey(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'anon';
}

export async function handleMiniRequest(request: Request, deps: MiniHandlerDeps): Promise<Response> {
  if (!deps.geminiApiKey) {
    return json({ ok: false, error: { code: 'NOT_CONFIGURED', message: 'Briefings are unavailable right now.' } }, 503);
  }

  let body: { text?: unknown; url?: unknown; title?: unknown; trigger?: unknown; depth?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid JSON body' } }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < MIN_INPUT_CHARS) {
    return json({
      ok: false,
      error: { code: 'TOO_SHORT', message: `Select at least ${MIN_INPUT_CHARS} characters, or run this on the whole article.` },
    }, 400);
  }

  const trigger: MiniTrigger = body.trigger === 'selection' ? 'selection' : 'article';
  const depth: 'outline' | 'full' = body.depth === 'full' ? 'full' : 'outline';
  const url = typeof body.url === 'string' ? body.url : undefined;
  const title = typeof body.title === 'string' ? body.title : undefined;

  const session = await deps.getSession(request).catch(() => null);

  // Quota. The outline is a tenth of a cent and the full run is eight cents, so
  // only the expensive half is metered. Metering the cheap half would spend the
  // user's daily allowance on the part that is nearly free.
  if (depth === 'full' && deps.rateLimitKv) {
    const key = session ? `mini:u:${session.userId}` : `mini:ip:${clientKey(request)}`;
    const cap = session ? deps.userDailyCap : deps.dailyCap;
    const quota = await checkAndIncrementQuota(deps.rateLimitKv, key, cap);
    if (!quota.allowed) {
      return json({ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily limit reached. Try again tomorrow.' } }, 429);
    }
  }

  const model = deps.model ?? 'gemini-2.5-flash';
  const miniDeps = { provider: deps.provider, apiKey: deps.geminiApiKey, model, trigger };

  try {
    if (depth === 'outline') {
      const t0 = Date.now();
      const r = await (deps.runOutline ?? extractOutline)(text.slice(0, MAX_INPUT_CHARS), miniDeps);
      const ms = Date.now() - t0;
      if (r.outline.claims.length === 0) {
        return json({
          ok: false,
          error: { code: 'NO_CLAIMS', message: 'Nothing here rests on a claim that can be checked against a source.' },
        }, 422);
      }
      // The outline alone is not stored: it is cheap, it is half a record, and
      // a table full of half-records makes every trend query say "it depends".
      // The full run stores the outline inside its payload.
      return json({ ok: true, depth: 'outline', id: null, outline: r.outline, ms });
    }

    const briefing = await (deps.runFull ?? buildMiniBriefing)(text.slice(0, MAX_INPUT_CHARS), miniDeps);

    let id: string | null = null;
    if (deps.db) {
      // Minted here so it can go back in the response even though the write
      // finishes after it. The id is the briefing's address and the handle the
      // owner marks a verdict against, so it cannot wait on the database.
      id = newMiniId();
      const save = saveMiniBriefing(deps.db, {
        id, briefing, trigger, depth, model,
        inputChars: text.length, url, title,
        userId: session?.userId ?? null,
      });
      // Storing must never delay the reader. When the platform gives us a way
      // to finish work after the response, use it; otherwise wait, because
      // losing the row is worse than a few milliseconds.
      if (deps.waitUntil) deps.waitUntil(save);
      else await save;
    }
    return json({ ok: true, depth: 'full', id, briefing });
  } catch (e) {
    console.error('mini: run failed', e);
    return json({ ok: false, error: { code: 'RUN_FAILED', message: 'The briefing could not be built. Try again.' } }, 502);
  }
}
