export const prerender = false;

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { GeminiProvider } from '../../../functions/_lib/providers/gemini';
import { fetchAndExtract } from '../../../functions/_lib/extract/article';
import { handleAuditRequest } from '../../../functions/_lib/audit/handler';

const provider = new GeminiProvider();

export const POST: APIRoute = async ({ request }) => {
  return handleAuditRequest(request, {
    rateLimitKv:   env.RATE_LIMIT,
    geminiApiKey:  env.GEMINI_API_KEY,
    auditDailyCap: parseInt(env.AUDIT_DAILY_CAP ?? '10', 10),
    provider,
    extractor:     fetchAndExtract,
  });
};
