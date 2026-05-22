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
      throw new ProviderError('network', `Gemini network error: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    const data = (await res.json()) as GeminiResponseBody;

    if (!res.ok || data.error) {
      const code = data.error?.code ?? res.status;
      const msg  = data.error?.message ?? `HTTP ${res.status}`;
      if (code === 429) throw new ProviderError('rate_limited', 'Gemini rate limit exceeded');
      throw new ProviderError('provider_error', msg);
    }

    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      throw new ProviderError('provider_error', 'Response blocked by safety filters');
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (text === undefined || text === null) {
      throw new ProviderError('provider_error', 'Empty response from Gemini');
    }

    return {
      content:      text,
      inputTokens:  data.usageMetadata?.promptTokenCount     ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
