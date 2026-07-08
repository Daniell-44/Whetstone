export const AUDIT_MODEL             = 'gemini-2.5-flash';
// Thinking tokens are pure latency. The audit is pattern-extraction, not deep
// reasoning, so a smaller budget cuts response time substantially with minimal
// quality cost. (Was 8192; raise again if finding quality visibly drops.)
export const AUDIT_THINKING_BUDGET   = 2048;
// The reader path (anonymous, no Phase-2 lenses) is lighter pattern-extraction
// and needs less thinking. A smaller budget cuts latency, which matters because
// the extension's MV3 service worker can be reaped on a slow audit. Phase-2
// (signed-in) keeps the larger budget.
export const AUDIT_READER_THINKING_BUDGET = 1024;
// Lower temperature → more consistent JSON → fewer schema-validation retries,
// AND run-to-run stable verdicts on hard cases (the corpus showed the same text
// yielding different fallacy sets across identical runs at 0.5; E6, 2026-07-08).
// Was 1.0 → 0.5 → 0.2. An audit is a precision/classification task, so low temp
// is register-correct; raise only if explanations start reading templated.
export const AUDIT_TEMPERATURE       = 0.2;
export const AUDIT_MAX_TOKENS        = 16384;
