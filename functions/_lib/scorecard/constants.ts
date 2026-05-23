// Model IDs for the two-stage synthesis pipeline.
// Change these to swap models without touching engine logic.

export const POSITION_SYNTHESIS_MODEL   = 'gemini-2.5-flash';
export const META_ANALYSIS_MODEL        = 'gemini-2.5-pro';

export const POSITION_SYNTHESIS_TEMPERATURE   = 0.2;
export const META_ANALYSIS_TEMPERATURE        = 0.2;

export const POSITION_SYNTHESIS_MAX_TOKENS    = 2048;
export const META_ANALYSIS_MAX_TOKENS         = 2048;

// Modest thinking budget for reasoning-level position synthesis.
// 0 is only correct for triage-style classification; never use 0 here.
export const POSITION_SYNTHESIS_THINKING_BUDGET = 2048;

// Generous thinking budget for the hardest reasoning step: finding the
// shared unstated assumption across all positions.
export const META_ANALYSIS_THINKING_BUDGET = 8192;
