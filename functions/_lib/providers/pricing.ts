// Per-model price table — USD per 1M tokens.
// Sources: provider pricing pages as of 2026-05.
// Update at M4 when production cost modelling begins (BUILD_BRIEF §12.1).

interface ModelPricing {
  inputPerMillion:  number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Gemini — https://ai.google.dev/pricing
  'gemini-2.5-flash':          { inputPerMillion:  0.30, outputPerMillion:  2.50 },
  'gemini-2.5-flash-lite':     { inputPerMillion:  0.10, outputPerMillion:  0.40 },
  'gemini-2.5-pro':            { inputPerMillion:  1.25, outputPerMillion: 10.00 },
  // Anthropic — https://www.anthropic.com/pricing
  'claude-opus-4-7':           { inputPerMillion: 15.00, outputPerMillion: 75.00 },
  'claude-sonnet-4-6':         { inputPerMillion:  3.00, outputPerMillion: 15.00 },
  'claude-haiku-4-5-20251001': { inputPerMillion:  0.80, outputPerMillion:  4.00 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.inputPerMillion + outputTokens * p.outputPerMillion) / 1_000_000;
}
