import type { LlmProvider, ProxyRequest, ProxyResponse } from './types';
import { ProviderError } from './types';

const ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1';

interface AnthropicResponseBody {
  content?: Array<{ type: string; text?: string }>;
  usage?:   { input_tokens: number; output_tokens: number };
  error?:   { type: string; message: string };
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  async complete(req: ProxyRequest, apiKey: string): Promise<ProxyResponse> {
    const { model, systemInstruction, messages, responseFormat, maxTokens, temperature } = req;

    // Anthropic has no schema-based JSON mode. Appending to the system instruction
    // is the recommended approach for structured output.
    const system = responseFormat === 'json'
      ? `${systemInstruction}\n\nOutput only valid JSON. No preamble, no commentary outside the JSON.`
      : systemInstruction;

    const body: Record<string, unknown> = {
      model,
      system,
      messages:   messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: maxTokens ?? 8192,
    };
    if (temperature !== undefined) body.temperature = temperature;

    let res: Response;
    try {
      res = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
        method:  'POST',
        headers: {
          'Content-Type':       'application/json',
          'x-api-key':          apiKey,
          'anthropic-version':  '2023-06-01',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ProviderError('network', `Anthropic network error: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    const data = (await res.json()) as AnthropicResponseBody;

    if (!res.ok) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 429)  throw new ProviderError('rate_limited', 'Anthropic rate limit exceeded');
      if (res.status === 400)  throw new ProviderError('bad_request', msg);
      throw new ProviderError('provider_error', msg);
    }

    const text = data.content?.find((b) => b.type === 'text')?.text;
    if (!text) throw new ProviderError('provider_error', 'Empty response from Anthropic');

    return {
      content:      text,
      inputTokens:  data.usage?.input_tokens  ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }
}
