export const AUDIT_MODEL             = 'gemini-2.5-flash';
// Thinking tokens are pure latency. The audit is pattern-extraction, not deep
// reasoning, so a smaller budget cuts response time substantially with minimal
// quality cost. (Was 8192; raise again if finding quality visibly drops.)
export const AUDIT_THINKING_BUDGET   = 2048;
// Lower temperature → more consistent JSON → fewer schema-validation retries
// (each retry adds a full call + backoff, the main cause of slow audits). Was 1.0.
export const AUDIT_TEMPERATURE       = 0.5;
export const AUDIT_MAX_TOKENS        = 16384;
