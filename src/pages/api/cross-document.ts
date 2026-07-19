export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { fetchAndExtractWithFallback } from '../../../functions/_lib/extract/scraper-fallback';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../functions/_lib/workspaces/permissions';
import { handleCrossDocumentRequest } from '../../../functions/_lib/cross-document/handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { makeDocumentDb } from '../../../functions/_lib/documents/db';
import { persistEngineRun } from '../../../functions/_lib/documents/persist-run';
import type { CrossDocumentResult } from '../../../functions/_lib/cross-document/types';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);

  const session = await getSessionFromRequest(request, authDb);

  const res = await handleCrossDocumentRequest(request, {
    rateLimitKv:       env.RATE_LIMIT,
    geminiApiKey:      env.GEMINI_API_KEY,
    crossDocDailyCap:  parseInt(env.CROSSDOC_DAILY_CAP ?? '5', 10),
    provider,
    extractor:         (url) => fetchAndExtractWithFallback(url, { scrapingBeeApiKey: env.SCRAPINGBEE_API_KEY }),
    getSession:        async () => session ? { userId: session.user_id } : null,
    checkSubscription: (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
  });

  // Persist successful runs for signed-in users so a 60-120s result survives
  // the tab closing. Failures must never break the run the user waited for.
  if (session && res.status === 200) {
    try {
      const data = await res.clone().json() as
        | { ok: true; result: CrossDocumentResult; usage?: unknown }
        | { ok: false };
      if (data.ok) {
        const docs  = data.result.documents;
        const title = `Cross-document: ${docs.length} doc${docs.length === 1 ? '' : 's'}`;
        // Input snapshot: the engine already trims each text to a preview
        // length for storage; the full result lives in result_json.
        const content = docs
          .map(d => `## ${d.label}${d.sourceUrl ? ` (${d.sourceUrl})` : ''}\n${d.text}`)
          .join('\n\n');
        const { docId } = await persistEngineRun(makeDocumentDb(env.DB), () => crypto.randomUUID(), {
          userId:     session.user_id,
          kind:       'cross-doc',
          title,
          content,
          resultJson: JSON.stringify(data.result),
        });
        return new Response(JSON.stringify({ ...data, savedDocumentId: docId }), {
          status:  200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.error('[cross-document] persist failed:', err instanceof Error ? err.message : err);
    }
  }

  return res;
};
