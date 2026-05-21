export interface ProxyRequest {
  operation:         'triage' | 'analyze' | 'synthesize';
  model:             string;
  systemInstruction: string;
  messages:          Array<{ role: 'user' | 'assistant'; content: string }>;
  responseFormat:    'json' | 'text';
  maxTokens?:        number;
  temperature?:      number;
  providerOverride?: 'gemini' | 'anthropic'; // only honoured when X-Cost-Test auth passes
}

export interface ProxyResponse {
  content:      string;
  inputTokens:  number;
  outputTokens: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(req: ProxyRequest, apiKey: string): Promise<ProxyResponse>;
}

export class ProviderError extends Error {
  constructor(
    public readonly kind: 'network' | 'rate_limited' | 'provider_error' | 'bad_request',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
