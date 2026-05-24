export interface ProxyRequest {
  operation:         'triage' | 'analyze' | 'synthesize';
  model:             string;
  systemInstruction: string;
  messages:          Array<{ role: 'user' | 'assistant'; content: string }>;
  responseFormat:    'json' | 'text';
  maxTokens?:        number;
  temperature?:      number;
  thinkingBudget?:   number;
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
    /** HTTP status code from the provider, if known. */
    public readonly status?: number,
    /** Whether this error is a transient failure that warrants a retry with backoff. */
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
