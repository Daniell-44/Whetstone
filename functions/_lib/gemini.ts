// DUPLICATED — will be replaced by shared @whetstone/engine package at M5.
// Chrome-free: no chrome.* APIs, no import.meta.env (Vite-only).

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ---------------------------------------------------------------------------
// LLM client interface
// ---------------------------------------------------------------------------

export interface LlmRequestOptions {
  model:              string;
  systemInstruction?: string;
  messages:           Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?:         number;
  temperature?:       number;
  responseSchema?:    unknown;
  thinkingBudget?:    number;
}

export interface LlmResponse {
  content: string;
}

// ---------------------------------------------------------------------------
// Gemini schema types (subset of JSON Schema the API accepts)
// ---------------------------------------------------------------------------

type GeminiSchemaType = 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';

interface GeminiSchema {
  type?:       GeminiSchemaType;
  nullable?:   boolean;
  enum?:       string[];
  items?:      GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?:   string[];
}

// ---------------------------------------------------------------------------
// Zod v4 internal _def shapes used for schema inspection.
// ---------------------------------------------------------------------------

interface ZodDefNullable  { type: 'nullable';  innerType: ZodNode }
interface ZodDefOptional  { type: 'optional';  innerType: ZodNode }
interface ZodDefArray     { type: 'array';     element:   ZodNode }
interface ZodDefObject    { type: 'object';    shape:     Record<string, ZodNode> }
interface ZodDefEnum      { type: 'enum';      entries:   Record<string, string> }
interface ZodDefPrimitive { type: 'string' | 'number' | 'boolean' }
type ZodDef = ZodDefNullable | ZodDefOptional | ZodDefArray | ZodDefObject | ZodDefEnum | ZodDefPrimitive;
type ZodNode = { _def: ZodDef };

function zodToGeminiSchema(schema: unknown): GeminiSchema {
  const { type } = (schema as ZodNode)._def;

  if (type === 'nullable') {
    const inner = zodToGeminiSchema(((schema as ZodNode)._def as ZodDefNullable).innerType);
    return { ...inner, nullable: true };
  }
  if (type === 'optional') {
    return zodToGeminiSchema(((schema as ZodNode)._def as ZodDefOptional).innerType);
  }
  if (type === 'string')  return { type: 'STRING' };
  if (type === 'number')  return { type: 'NUMBER' };
  if (type === 'boolean') return { type: 'BOOLEAN' };

  if (type === 'enum') {
    return { type: 'STRING', enum: Object.values(((schema as ZodNode)._def as ZodDefEnum).entries) };
  }
  if (type === 'array') {
    return { type: 'ARRAY', items: zodToGeminiSchema(((schema as ZodNode)._def as ZodDefArray).element) };
  }
  if (type === 'object') {
    const shape = ((schema as ZodNode)._def as ZodDefObject).shape;
    const properties: Record<string, GeminiSchema> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToGeminiSchema(value);
      if ((value as ZodNode)._def.type !== 'optional') required.push(key);
    }
    const result: GeminiSchema = { type: 'OBJECT', properties };
    if (required.length > 0) result.required = required;
    return result;
  }

  return { type: 'STRING' };
}

// ---------------------------------------------------------------------------
// Gemini API wire types
// ---------------------------------------------------------------------------

interface GeminiPart    { text: string }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }
interface GeminiRequest {
  system_instruction?: { parts: GeminiPart[] };
  contents: GeminiContent[];
  generationConfig?: {
    responseMimeType?: string;
    responseSchema?:   GeminiSchema;
    maxOutputTokens?:  number;
    temperature?:      number;
    thinkingConfig?:   { thinkingBudget: number };
  };
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?:     { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string; status: string };
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class GeminiApiError extends Error {
  constructor(message: string, public readonly code: number, public readonly status: string) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

export class GeminiRateLimitError extends GeminiApiError {
  constructor(message: string) {
    super(message, 429, 'RESOURCE_EXHAUSTED');
    this.name = 'GeminiRateLimitError';
  }
}

export class GeminiSafetyError extends GeminiApiError {
  constructor(reason: string) {
    super(`Response blocked by safety filters: ${reason}`, 200, 'SAFETY');
    this.name = 'GeminiSafetyError';
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class GeminiClient {
  constructor(private readonly apiKey: string) {}

  async complete(options: LlmRequestOptions): Promise<LlmResponse> {
    const { model, messages, systemInstruction, maxTokens, temperature, responseSchema, thinkingBudget } = options;

    const body: GeminiRequest = {
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    };

    if (systemInstruction) body.system_instruction = { parts: [{ text: systemInstruction }] };

    const genConfig: NonNullable<GeminiRequest['generationConfig']> = {};
    if (maxTokens !== undefined) genConfig.maxOutputTokens = maxTokens;
    if (temperature !== undefined) genConfig.temperature = temperature;
    if (thinkingBudget !== undefined) genConfig.thinkingConfig = { thinkingBudget };
    if (responseSchema) {
      genConfig.responseMimeType = 'application/json';
      genConfig.responseSchema = zodToGeminiSchema(responseSchema);
    }
    if (Object.keys(genConfig).length > 0) body.generationConfig = genConfig;

    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new GeminiApiError(
        `Network error: ${err instanceof Error ? err.message : 'unknown'}`,
        0,
        'NETWORK_ERROR',
      );
    }

    const data = (await response.json()) as GeminiResponseBody;

    if (!response.ok || data.error) {
      const e = data.error;
      const code = e?.code ?? response.status;
      const status = e?.status ?? response.statusText;
      const message = e?.message ?? `HTTP ${response.status}`;
      if (code === 429) throw new GeminiRateLimitError(message);
      throw new GeminiApiError(message, code, status);
    }

    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      throw new GeminiSafetyError(data.promptFeedback?.blockReason ?? 'unknown reason');
    }

    const text = candidate?.content?.parts?.[0]?.text;
    if (text === undefined || text === null) {
      throw new GeminiApiError('Empty response from Gemini', 500, 'EMPTY_RESPONSE');
    }

    return { content: text };
  }
}
