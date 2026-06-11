/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

// Extend Cloudflare.Env so that `import { env } from "cloudflare:workers"` is
// correctly typed for all KV bindings used by server-rendered Astro pages.
declare namespace Cloudflare {
  interface Env {
    SCORECARDS:           KVNamespace;
    RATE_LIMIT:           KVNamespace;
    AUDIT_LINKS:          KVNamespace;
    DB:                   D1Database;
    ANALYSER_SECRET?:     string;
    GEMINI_API_KEY?:      string;
    ANTHROPIC_API_KEY?:   string;
    TAVILY_API_KEY?:      string;
    RESEND_API_KEY?:      string;
    LLM_PROVIDER?:        string;
    FREE_TIER_DAILY_CAP?: string;
    AUDIT_DAILY_CAP?:      string;
    AUDIT_USER_DAILY_CAP?: string;
    COUNTERARG_DAILY_CAP?:  string;
    COMMITMENTS_DAILY_CAP?: string;
    CITATION_DAILY_CAP?:    string;
    VALIDITY_DAILY_CAP?:    string;
    EVIDENCE_DAILY_CAP?:    string;
    TONE_DAILY_CAP?:        string;
    PRESUP_DAILY_CAP?:      string;
    RHET_DAILY_CAP?:        string;
    HUMILITY_DAILY_CAP?:    string;
    DISAGREE_DAILY_CAP?:    string;
    SI_DAILY_CAP?:          string;
    CROSSDOC_DAILY_CAP?:    string;
    SCRAPINGBEE_API_KEY?:   string;
    PUBLIC_COUNTERARG_DAILY_CAP?:   string;
    LOGGEDIN_COUNTERARG_DAILY_CAP?: string;
    TRANSCRIPT_DAILY_CAP?:          string;
    ALLOWED_ORIGINS?:      string;
    COST_TEST_SECRET?:    string;
    SITE_URL?:            string;
    AUTH_DEBUG_LOG_CODES?:string;
    // Stripe — secrets set via wrangler secret put, not in wrangler.toml
    STRIPE_SECRET_KEY?:   string;
    STRIPE_WEBHOOK_SECRET?: string;
    // Stripe price ID — set in wrangler.toml [vars] after creating the product
    STRIPE_PRICE_ID?:     string;
  }
}
