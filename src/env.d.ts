/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

// Extend Cloudflare.Env so that `import { env } from "cloudflare:workers"` is
// correctly typed for all KV bindings used by server-rendered Astro pages.
declare namespace Cloudflare {
  interface Env {
    SCORECARDS:           KVNamespace;
    RATE_LIMIT:           KVNamespace;
    ANALYSER_SECRET?:     string;
    GEMINI_API_KEY?:      string;
    LLM_PROVIDER?:        string;
    FREE_TIER_DAILY_CAP?: string;
  }
}
