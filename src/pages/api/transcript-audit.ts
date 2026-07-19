export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { makeAuthDb } from '../../../functions/_lib/auth/db';
import { makeBillingDb } from '../../../functions/_lib/billing/subscription';
import { makeWorkspaceDb } from '../../../functions/_lib/workspaces/db';
import { userHasActiveSubscriptionViaWorkspace } from '../../../functions/_lib/workspaces/permissions';
import { handleTranscriptRequest } from '../../../functions/_lib/transcript/handler';
import { getSessionFromRequest } from '../../../functions/_lib/auth/sessions';
import { makeDocumentDb } from '../../../functions/_lib/documents/db';
import { persistEngineRun } from '../../../functions/_lib/documents/persist-run';
import type { TranscriptAuditResult } from '../../../functions/_lib/transcript/types';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  const authDb      = makeAuthDb(env.DB);
  const billingDb   = makeBillingDb(env.DB);
  const workspaceDb = makeWorkspaceDb(env.DB);

  const session = await getSessionFromRequest(request, authDb);

  const res = await handleTranscriptRequest(request, {
    rateLimitKv:        env.RATE_LIMIT,
    geminiApiKey:       env.GEMINI_API_KEY,
    transcriptDailyCap: parseInt(env.TRANSCRIPT_DAILY_CAP ?? '5', 10),
    provider,
    getSession:         async () => session ? { userId: session.user_id } : null,
    checkSubscription:  (userId) => userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId),
  });

  // Persist successful runs for signed-in users so a 60-120s result survives
  // the tab closing. Failures must never break the run the user waited for.
  if (session && res.status === 200) {
    try {
      const data = await res.clone().json() as
        | { ok: true; result: TranscriptAuditResult; usage?: unknown }
        | { ok: false };
      if (data.ok) {
        const input = data.result.input;
        const title =
          input.title?.trim() ||
          input.sourceUrl?.trim() ||
          'Transcript audit';
        const content = input.cues.map(c => c.text).join('\n');
        const { docId } = await persistEngineRun(makeDocumentDb(env.DB), () => crypto.randomUUID(), {
          userId:     session.user_id,
          kind:       'transcript',
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
      console.error('[transcript-audit] persist failed:', err instanceof Error ? err.message : err);
    }
  }

  return res;
};
