import type { LlmProvider, ProxyRequest, ProxyResponse } from './types';
import { ProviderError } from './types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponseBody {
  candidates?: Array<{
    content?:      { parts?: Array<{ text: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount:      number;
    candidatesTokenCount:  number;
  };
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string; status: string };
}

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  async complete(req: ProxyRequest, apiKey: string): Promise<ProxyResponse> {
    const { model, systemInstruction, messages, responseFormat, maxTokens, temperature, thinkingBudget } = req;

    const body: Record<string, unknown> = {
      contents: messages.map((m) => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      system_instruction: { parts: [{ text: systemInstruction }] },
    };

    const genConfig: Record<string, unknown> = {};
    if (maxTokens !== undefined)       genConfig.maxOutputTokens = maxTokens;
    if (temperature !== undefined)     genConfig.temperature = temperature;
    if (thinkingBudget !== undefined)  genConfig.thinkingConfig = { thinkingBudget };
    // JSON mode without schema — extension validates structure locally with Zod.
    if (responseFormat === 'json')  genConfig.responseMimeType = 'application/json';
    if (Object.keys(genConfig).length > 0) body.generationConfig = genConfig;

    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
    } catch (err) {
      // Network-level failure — retryable (transient connectivity issue).
      throw new ProviderError(
        'network',
        `Gemini network error: ${err instanceof Error ? err.message : 'unknown'}`,
        undefined,
        true,
      );
    }

    const data = (await res.json()) as GeminiResponseBody;

    if (!res.ok || data.error) {
      const httpStatus = res.status;
      const msg        = data.error?.message ?? `HTTP ${httpStatus}`;

      if (httpStatus === 429) {
        // Rate-limit — retryable with backoff.
        throw new ProviderError('rate_limited', 'Gemini rate limit exceeded', 429, true);
      }
      if (httpStatus >= 500) {
        // 5xx overload / server error — retryable with backoff.
        throw new ProviderError('provider_error', msg, httpStatus, true);
      }
      // 4xx (auth, bad request, quota exhausted, etc.) — fail fast.
      throw new ProviderError('bad_request', msg, httpStatus, false);
    }

    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      // Safety block is a content issue, not a capacity issue — not retryable.
      throw new ProviderError('provider_error', 'Response blocked by safety filters', res.status, false);
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (text === undefined || text === null) {
      throw new ProviderError('provider_error', 'Empty response from Gemini', res.status, false);
    }

    return {
      content:      text,
      inputTokens:  data.usageMetadata?.promptTokenCount     ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
