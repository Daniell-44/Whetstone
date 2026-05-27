# The Whetstone — Build Brief

This file is the canonical record of what has been built and why, updated after each prompt.

---

## Track: Public Analyser

The Public Analyser publishes Logic Scorecards — visual audits of public debates.
Each scorecard covers two to five positions, giving each a Best Case (Claim–Grounds–Warrant)
and a Fatal Flaw, then identifies a Meta-Analysis: the unstated assumption all sides share.

---

## Prompt 1 — Scorecard page

**Committed:** `dd8b8d0`

- `src/lib/scorecard.ts` — canonical types (re-exports from `functions/_lib/scorecard/types.ts`)
- `src/data/scorecards.ts` — one hand-written mock debate (`smartphone-ban-schools`)
- `src/components/scorecard/` — UI components (ScoreCard, Position, MetaAnalysis, Source)
- `src/pages/scorecard/[slug].astro` — dynamic route that renders a scorecard from data

---

## Prompt 2 — Synthesis engine

**Committed:** `adf6ec6`

Two-stage LLM pipeline that turns raw debate documents into a Scorecard.

**Stage 1** (per position, run in parallel): `gemini-2.5-flash`, 2 k thinking budget.
Produces a Claim–Grounds–Warrant chain (Best Case) and a named Fatal Flaw.

**Stage 2** (once, after Stage 1): `gemini-2.5-pro`, 8 k thinking budget.
Produces a dek and the bridging warrant (shared unstated assumption).

Key files:

| File | Purpose |
|---|---|
| `functions/_lib/scorecard/types.ts` | Canonical `Scorecard`, `ScorecardPosition`, `ToulminChain` interfaces |
| `functions/_lib/scorecard/schemas.ts` | Zod schemas for input and per-stage LLM output |
| `functions/_lib/scorecard/prompts.ts` | System prompts and user-prompt builders for both stages |
| `functions/_lib/scorecard/constants.ts` | Model IDs, temperatures, token/thinking budgets |
| `functions/_lib/scorecard/engine.ts` | `generateScorecard(input, deps)` — orchestrates both stages with retry |
| `functions/_lib/scorecard/fixtures/sample-debate.json` | 3-position smartphone-ban debate fixture |
| `functions/api/analyse-debate.ts` | `POST /api/analyse-debate` — secret-gated endpoint |
| `scripts/run-scorecard.ts` | `npm run scorecard:demo` — local runner against real Gemini API |

Input shape: `DebateInput` — question + positions, each with 1–5 source articles
`{ title, publication, url, text }`.

Output: `Scorecard` — the full structured result ready for the UI.

---

## Prompt 3.5 — Engine resilience + verified run

**Committed:** (this prompt)

### Retry / backoff — `callWithRetry` (engine.ts)

Three failure modes, treated differently:

| Failure | Behaviour |
|---|---|
| Retryable provider error (5xx overload, 429 rate-limit, network error) | Exponential backoff: up to 4 attempts, waits ~2 s / 6 s / 15 s |
| Malformed / invalid JSON from the model | Retry once immediately (no delay), as before |
| Hard error (4xx — auth, bad request, quota) | Fail fast, no retry |

Classification is via `ProviderError.retryable` (new field) set by `GeminiProvider`:
- HTTP 429 → `kind: 'rate_limited'`, `retryable: true`
- HTTP 5xx → `kind: 'provider_error'`, `retryable: true`
- HTTP 4xx → `kind: 'bad_request'`, `retryable: false`
- Network throw → `kind: 'network'`, `retryable: true`
- Safety block / empty response → `kind: 'provider_error'`, `retryable: false`

`ProviderError` gains two new fields: `status?: number` (HTTP status) and `retryable: boolean` (default `false`). All existing call sites are backward-compatible.

`backoffDelaysMs` is injectable via engine `deps` so tests use `[0, 0, 0]` and stay fast.

### Model overrides — `EngineDeps`

`generateScorecard` now accepts optional `stage1Model?: string` and `stage2Model?: string` in deps, defaulting to the constants. The demo runner and tests use these for the flash fallback and model-override assertions respectively.

### Demo runner flash fallback (`scripts/run-scorecard.ts`)

1. Runs normally with production models.
2. If Stage 2 (`gemini-2.5-pro`) exhausts backoff retries with an overload error, retries once with `stage2Model: 'gemini-2.5-flash'`.
3. On fallback: prints a clearly labelled banner and adds `_stage2Model: 'gemini-2.5-flash'` to `scorecard-output.json`.
4. Hard errors (4xx, auth) do not trigger the fallback.

This is **demo-runner only**. The production engine (`/api/analyse-debate`) surfaces overload errors after exhausting backoff — no silent model downgrade in production.

### Verified run (2026-05-24)

`npm run scorecard:demo` succeeded on first attempt with **`gemini-2.5-pro` for Stage 2 (no fallback)**. Total: 4 227 input tokens, 1 111 output tokens, ~23 s.

---

## Prompt 3 — URL article extraction

**Committed:** (this prompt)

Server-side layer that accepts a URL and returns clean article text suitable for
dropping straight into a `DebateInput` article slot — or a structured error so the
UI can fall back to a manual paste box.

### Result contract

Discriminated union — always 200 from the endpoint:

```ts
type ExtractResult =
  | { ok: true;  article: { title: string; publication: string; url: string; text: string } }
  | { ok: false; error:   { code: ErrorCode; message: string } }

type ErrorCode = 'FETCH_FAILED' | 'NOT_HTML' | 'EXTRACTION_FAILED' | 'TOO_SHORT'
```

### Extraction approach

**linkedom-only** (not Readability + linkedom).

The brief preferred `linkedom + @mozilla/readability`. Both packages are installed.
At runtime the pairing works, but `@mozilla/readability`'s type declarations reference
browser globals (`Document`, `HTMLElement`, etc.) that are absent in `tsconfig.functions.json`
(`"lib": ["ESNext"]`, no DOM). Rather than add DOM types to the functions tsconfig,
the hand-rolled linkedom extraction (explicitly allowed by the brief) was used instead.
`"skipLibCheck": true` was added to `tsconfig.functions.json` so that linkedom's own
declaration files (which also extend DOM globals) do not break `npm run typecheck`.

**Extraction steps in `extractArticleFromHtml`:**

1. `parseHTML(html)` → linkedom document
2. Title from `og:title` → `<title>` element
3. Publication from `og:site_name` → `URL.hostname` (stripped of `www.`)
4. Content root: `<article>` → `<main>` → `<body>`
5. Strip noise in place: `script style nav header footer aside form button noscript iframe figure figcaption`
6. Collect `<p>` text (≥ 20 chars each), join with blank lines
7. < 1 paragraph → `EXTRACTION_FAILED`; < 250 words → `TOO_SHORT`

**`fetchAndExtract` robustness:**

- `AbortController` with 10 s timeout (applies to initial request)
- Realistic browser `User-Agent` + `Accept` headers, `redirect: 'follow'`
- Non-2xx → `FETCH_FAILED`
- `Content-Type` must include `text/html` → else `NOT_HTML`
- Body capped at 5 MB via streaming reader
- Network error / throw → `FETCH_FAILED`

### Key files

| File | Purpose |
|---|---|
| `functions/_lib/extract/article.ts` | `extractArticleFromHtml` (pure, sync) + `fetchAndExtract` (async, network) |
| `functions/_lib/extract/fixtures/well-formed-article.html` | 5-paragraph article; used in tests → `ok: true` |
| `functions/_lib/extract/fixtures/paywall-stub.html` | Paywall gate; → `TOO_SHORT` |
| `functions/_lib/extract/fixtures/homepage.html` | Nav-heavy homepage; → `EXTRACTION_FAILED` |
| `functions/api/extract-article.ts` | `POST /api/extract-article` — `X-Analyser-Secret` gated |
| `tests/extract/article.test.ts` | 17 tests covering all fixtures + network stub |

### Endpoint

`POST /api/extract-article`

Headers: `X-Analyser-Secret: <secret>` (must match `ANALYSER_SECRET` env var)

Body: `{ "url": "https://..." }`

Response (always 200 on successful request):
```json
{ "ok": true,  "article": { "title": "...", "publication": "...", "url": "...", "text": "..." } }
{ "ok": false, "error":   { "code": "TOO_SHORT", "message": "Extracted 43 words; minimum is 250" } }
```

Error responses: 401 (bad/missing secret), 405 (non-POST), 400 (invalid JSON or non-URL body).

---

## Prompt 4 — Storage & publishing layer

**Committed:** (this prompt)

### Rendering mode

Astro 6 is used with `output: 'static'` (the default). Marketing and content pages stay fully prerendered. Scorecard routes opt out with `export const prerender = false`, making them on-demand server-rendered by the Cloudflare adapter.

**Adapter:** `@astrojs/cloudflare` v13 (required Astro ≥ 6.3, so Astro was upgraded from 6.1.10 → 6.3.7 and wrangler from v3 → v4).

Bindings in server-rendered pages are accessed via `import { env } from "cloudflare:workers"` — the `Astro.locals.runtime.env` pattern was removed in adapter v13 / Astro v6. The `Cloudflare.Env` namespace is extended in `src/env.d.ts` so TypeScript knows the binding types.

One wrangler.toml note: `pages_build_output_dir` was removed because wrangler v4 uses it to enter "Pages mode", which forbids a binding named `ASSETS` — but the adapter auto-generates that binding name for the prerender step. Removing the field fixes the build without affecting functionality (the path is passed as a CLI arg to `wrangler pages dev` anyway).

### KV namespace — SCORECARDS

**Daniel must run these commands once to create the namespace:**

```bash
# Production namespace
wrangler kv namespace create SCORECARDS
# → paste the returned id into wrangler.toml under the SCORECARDS binding

# Preview namespace (used by Cloudflare Pages preview deployments)
wrangler kv namespace create SCORECARDS --preview
# → paste the returned id as preview_id in wrangler.toml

# Also add both IDs as a binding in the Pages dashboard:
#   Settings → Functions → KV namespace bindings → name: SCORECARDS
```

### Storage module (`functions/_lib/scorecard/storage.ts`)

Three functions backed by the `SCORECARDS` KV namespace:

| Function | Behaviour |
|---|---|
| `saveScorecard(kv, scorecard)` | Validates against `ScorecardSchema` before writing; stores under `scorecard:<slug>` |
| `getScorecard(kv, slug)` | Reads from KV; falls back to `src/data/scorecards.ts` if absent; validates before returning |
| `listScorecards(kv)` | KV entries merged with fallback array (KV wins on slug collision); sorted by `publishedDate` descending |

Enumeration uses `kv.list({ prefix: 'scorecard:' })` rather than a separate index key — avoids write-consistency issues at the cost of one extra round-trip per listed scorecard (fine at the expected scale of dozens).

### Save endpoint (`src/pages/api/save-scorecard.ts`)

`POST /api/save-scorecard`

- Gated by `X-Analyser-Secret` header (same pattern as `analyse-debate.ts`)
- Validates body against `ScorecardSchema`
- Calls `saveScorecard`, returns `{ slug }`

### Zod schema for Scorecard (`functions/_lib/scorecard/schemas.ts`)

`ScorecardSchema` and sub-schemas (`ScorecardPositionSchema`, `ToulminChainSchema`, `ScorecardSourceSchema`) added. These mirror the TypeScript interfaces in `types.ts` and are used by `storage.ts` and `save-scorecard.ts`.

### Public pages rewired

| Page | Change |
|---|---|
| `src/pages/scorecard/[slug].astro` | Removed `getStaticPaths`; added `prerender = false`; reads from KV via `env.SCORECARDS`; returns 404 if not found |
| `src/pages/scorecards/index.astro` | New index page (on-demand); calls `listScorecards`; lists all published scorecards with link to each |

### Tests

12 new tests in `tests/scorecard/storage.test.ts` using a `FakeKV` (Map-backed, no workers dependency):
- `saveScorecard`: rejects invalid schema, missing positions, bad date format
- `getScorecard`: returns KV copy when present; falls back to hardcoded data; returns null when absent
- `listScorecards`: merges KV + fallback; KV wins on collision; dedupes; sorts descending by date

Full suite: **66 tests, all passing** (12 new + 54 existing).

### Build status

- `npm run build` — exit 0 (one pre-existing non-fatal warning from `privacy.astro` using `node:fs` in the prerender environment)
- `npx astro check` — 0 errors
- `npm run typecheck` — 0 errors

---

## Prompt 5 — Port Pages Functions to Astro API routes

**Committed:** (this prompt)

### Deployment model

The `@astrojs/cloudflare` v13 adapter uses `@cloudflare/vite-plugin` and compiles the project into a **Cloudflare Workers + Static Assets** deployment — not Cloudflare Pages Functions. The build produces:

- `dist/client/` — prerendered HTML, CSS, JS served via the `ASSETS` binding
- `dist/server/` — the compiled Cloudflare Worker (`entry.mjs`) with an auto-generated `wrangler.json` containing all bindings

Cloudflare completely ignores the `functions/` directory when a Worker is deployed. Any code in `functions/api/` was therefore never reaching production.

### What changed

All six API endpoints were moved from `functions/api/` (Cloudflare Pages Functions) to `src/pages/api/` (Astro API routes compiled into the Worker):

| Old path | New path |
|---|---|
| `functions/api/analyze.ts` | `src/pages/api/analyze.ts` |
| `functions/api/retrieve.ts` | `src/pages/api/retrieve.ts` |
| `functions/api/llm.ts` | `src/pages/api/llm.ts` |
| `functions/api/analyse-debate.ts` | `src/pages/api/analyse-debate.ts` |
| `functions/api/extract-article.ts` | `src/pages/api/extract-article.ts` |
| `functions/api/save-scorecard.ts` | `src/pages/api/save-scorecard.ts` |

Each file:
- Adds `export const prerender = false;` at the top
- Exports named HTTP method handlers (`POST`, `OPTIONS`) using the Astro `APIRoute` type instead of `onRequest` / `onRequestPost`
- Accesses bindings and env vars via `import { env } from "cloudflare:workers"` — the same pattern already used by the Astro pages
- Imports shared logic from `functions/_lib/` unchanged (same relative paths, just one level deeper)

The `functions/_lib/` directory is untouched and stays in place. `src/env.d.ts` was extended to declare all bindings used by the new routes (`TAVILY_API_KEY`, `ANTHROPIC_API_KEY`, `COST_TEST_SECRET`, `ALLOWED_ORIGINS`).

### Deploy sequence

```bash
# 1. Build
pnpm build        # or: npm run build

# 2. Deploy the Worker (run from the site/ root)
wrangler deploy --config dist/server/wrangler.json
```

KV namespace IDs are baked into `dist/server/wrangler.json` by the build — no extra binding step needed.

### Secrets — set once after first deploy

Secrets are NOT in `wrangler.json`. Run these after the first `wrangler deploy`:

```bash
wrangler secret put ANALYSER_SECRET    --config dist/server/wrangler.json
wrangler secret put GEMINI_API_KEY     --config dist/server/wrangler.json
wrangler secret put ANTHROPIC_API_KEY  --config dist/server/wrangler.json
wrangler secret put TAVILY_API_KEY     --config dist/server/wrangler.json
wrangler secret put COST_TEST_SECRET   --config dist/server/wrangler.json
```

`ALLOWED_ORIGINS`, `LLM_PROVIDER`, and `FREE_TIER_DAILY_CAP` are plain vars (not secrets) and are set in `wrangler.toml` under `[vars]` — they are picked up automatically.

### Build status

- `npm test` — 66/66 passing (library functions unchanged)
- `npm run build` — exit 0 (same pre-existing `privacy.astro` node:fs warning)
- `npx astro check` — 0 errors
- `npm run typecheck` — 0 errors
- All 6 routes confirmed present in `dist/server/chunks/`

---

## Prompt 6 — Curator authoring page

**Committed:** (this prompt)

### What was built

A private authoring page at `/curator` — the curator's cockpit for composing, generating, and publishing Logic Scorecards without any source-code edits. After this prompt the full publish loop runs end-to-end in the browser: enter URLs → extract articles → generate scorecard → edit inline → save to KV → public page live.

### Framework decision

**`@astrojs/preact` v5.1.3** added as the UI framework for the editor island. The rest of the site remains vanilla Astro + Tailwind — no React, no Vue. Preact was chosen because:
- It is the Astro-recommended lightweight option for client islands
- The editor is the only heavily-interactive surface on the site
- `@astrojs/preact` integrates cleanly with the existing Vite + Tailwind v4 pipeline

`tsconfig.json` gains `"jsx": "react-jsx"` and `"jsxImportSource": "preact"` so that `.tsx` files are correctly type-checked with Preact's JSX types. `.astro` files are unaffected (Astro's compiler handles them separately).

### Authentication model

- The page is publicly reachable at `/curator` — no server-side gate.
- All three API calls (`/api/extract-article`, `/api/analyse-debate`, `/api/save-scorecard`) require `X-Analyser-Secret`.
- The secret is entered in a password field at the top of the page and **persisted in `sessionStorage`** under the key `whetstone-curator-secret`; it is auto-loaded on every page open.
- Every fetch attaches the secret as the `X-Analyser-Secret` header.
- A 401 response surfaces "Secret invalid — check the secret field above." inline, near the control that triggered it.

### Page structure (three sections, top-to-bottom)

| Section | Purpose |
|---|---|
| **Settings (a)** | Password-type secret field; "Load existing" dropdown (server-side `listScorecards` result, full `Scorecard[]` objects passed as an island prop); "New blank scorecard" button |
| **Composer (b)** | Debate question; dynamic 2–5 positions each with 1–n articles (URL + Extract button + editable title/publication/text); "Generate scorecard" button — POSTs to `/api/analyse-debate`, ~30 s, shows spinner, populates Editor on success |
| **Editor (c)** | Visible once a draft exists (from Generate, Load existing, or New blank). Every `Scorecard` field is editable: slug, question, dek, publishedDate, per-position label + best-case (claim/grounds/warrant) + fatal flaw (name/explanation) + sources (add/remove); meta-analysis bridging warrant + explanation; "Save & publish" button → POST `/api/save-scorecard` → success shows slug + link to live page |

### Slug handling

Auto-derives slug from the question on every keystroke in the Editor **until the slug field is touched directly**. Once the user edits the slug field, `slugTouched` flips to `true` and auto-derivation stops permanently for that draft session. Loading an existing scorecard also sets `slugTouched = true` to prevent overwriting the canonical slug.

### Error handling

| Scenario | Message |
|---|---|
| 401 | "Secret invalid — check the secret field above." |
| 500 | "Server error: `<verbatim server message>`" |
| Network throw | "Network error — check your connection." |
| Extract `TOO_SHORT` | "Article too short — paste the text manually." |
| Extract `NOT_HTML` | "URL does not point to HTML — paste the text manually." |
| Extract `FETCH_FAILED` | "Could not fetch the URL — paste the text manually." |
| Extract `EXTRACTION_FAILED` | "Could not extract article text — paste the text manually." |

### Key files

| File | Purpose |
|---|---|
| `src/pages/curator/index.astro` | Astro page shell; `prerender = false`; fetches `listScorecards` server-side; passes results to island |
| `src/components/curator/CuratorEditor.tsx` | Preact island — full editor with all three sections |
| `src/lib/curatorHelpers.ts` | `deriveSlug`, `isPositionCountValid`, `arePositionsReadyForGeneration` — pure helpers |
| `tests/curator/helpers.test.ts` | 21 Vitest tests covering all three helpers |

### Tests

21 new tests in `tests/curator/helpers.test.ts` covering:
- `deriveSlug`: lowercase, hyphenation, punctuation stripping, whitespace collapse, empty input, real slug roundtrip
- `isPositionCountValid`: boundary values 0, 1, 2, 3, 5, 6
- `arePositionsReadyForGeneration`: valid/invalid label, all-empty articles, out-of-range counts, whitespace-only label

Full suite: **87 tests, all passing** (21 new + 66 existing).

### Build status

- `pnpm test` — 87/87 passing
- `pnpm run build` — exit 0 (same pre-existing `privacy.astro` node:fs warning; no new warnings)
- `npx astro check` — 0 errors, 0 warnings (4 pre-existing hints in existing files, unchanged)
- `pnpm run typecheck` — 0 errors

### Post-deploy steps (after `wrangler deploy`)

1. **Build:** `pnpm run build`
2. **Deploy:** `wrangler deploy --config dist/server/wrangler.json`
3. **Open:** `https://devils-advocate-site.daniellivingstone2005.workers.dev/curator`
4. **Paste the secret** (`wh-analyser-d4f7a2e9c1b83065` from `.dev.vars`, or whatever is set in production via `wrangler secret put ANALYSER_SECRET`)
5. **Try the Generate flow:** enter a question, add 2 positions with article URLs, click Extract, click Generate — watch the Editor populate after ~30 s
6. **Try the Manual flow:** click "New blank scorecard", fill all fields, click Save & publish
7. **Try Load existing:** select a scorecard from the dropdown, edit a field, Save & publish to overwrite

---

## Polish pass — privacy, studio stub, accessibility, stale script

**Committed:** (this prompt)

Five small cleanups to make the Public Analyser launch-ready.

| # | Change | File(s) |
|---|---|---|
| 1 | Replaced `node:fs` + `marked` privacy page with inline HTML content; eliminates build error | `src/pages/privacy.astro` |
| 2 | Added `/studio` coming-soon stub with description and early-access email form | `src/pages/studio/index.astro` |
| 3 | Promoted position label from `<p>` to `<h2>` in PositionCard; heading hierarchy is now h1 (question) → h2 (position labels) → h3 (Best Case / Fatal Flaw / Sources) | `src/components/scorecard/PositionCard.astro` |
| 4 | Removed stale `pages:dev` script (referenced old `wrangler pages dev ./dist`; deployment model is now Worker, not Pages) | `package.json` |
| 5 | BUILD_BRIEF updated — Public Analyser marked feature-complete, next track documented | `BUILD_BRIEF.md` |

### Build status

- `pnpm test` — 87/87 passing (no changes to test files)
- `pnpm run build` — exit 0, **zero warnings** (privacy.astro node:fs warning gone)
- `npx astro check` — 0 errors, 0 warnings
- `pnpm run typecheck` — 0 errors

---

## Track status

### Public Analyser — **feature-complete**

All six engineering prompts delivered and deployed:

| Prompt | Deliverable |
|---|---|
| 1 | Scorecard display page |
| 2 | Two-stage LLM synthesis engine |
| 3 | URL article extraction |
| 3.5 | Engine resilience + verified run |
| 4 | KV storage + public SSR pages |
| 5 | Port Pages Functions → Astro API routes |
| 6 | Curator authoring page |
| Polish | Privacy fix, studio stub, a11y, stale script |

The publish loop is fully operational: curator enters URLs → extraction → generation → inline edit → save → live at `/scorecard/<slug>`.

---

### Lens A — **complete**

Engine + public page + rate-limited endpoint all built and passing.

---

## Lens A, Prompt 1 — single-text audit engine

**Committed:** (this prompt)

### What was built

`auditText(text, deps)` — a single-call, single-pass audit engine that runs a piece of argumentative text through `gemini-2.5-flash` (4 096 thinking budget) and returns a fully typed `AuditResult`.

The shared `callWithRetry` helper was extracted from `functions/_lib/scorecard/engine.ts` into `functions/_lib/llm/retry.ts`; both the scorecard engine and the audit engine import from that shared module.

### Output schema — `AuditResult`

```typescript
interface AuditResult {
  centralClaim:   string;
  toulmin: {
    claim:            string;
    grounds:          string;
    statedWarrant:    string | null;
    unstatedWarrants: Array<{ warrant: string; necessity: string }>;
    weakestLink:      string;
  };
  namedFallacies: Array<{ name: FallacyName; quote: string; explanation: string; severity: 'high'|'medium'|'low' }>;
  loadedLanguage: Array<{ phrase: string; technique: LoadedLanguageTechnique; explanation: string }>;
  notes:          string | null;
}
```

Post-validation (`validateQuotesInText`) checks every `quote` and `phrase` is a verbatim substring of the input. If any are not, an error is thrown before the result is returned — this prevents the model from paraphrasing and presenting made-up quotes.

### Taxonomy

**12 fallacies:** Ad Hominem, Straw Man, False Dichotomy, Slippery Slope, Appeal to Authority, Appeal to Emotion, Circular Reasoning, Hasty Generalisation, Red Herring, Tu Quoque, Post Hoc, Equivocation

**5 loaded-language techniques:** Emotionally charged terms, Weasel words, Name-calling / dysphemism, Glittering generalities, False-precision numbers

### Resilience

Same `callWithRetry` policy as the scorecard engine: 4 total attempts (3 backoffs at 2 s / 6 s / 15 s), immediate retry on bad JSON, fast-fail on 4xx.

### Key files

| File | Purpose |
|---|---|
| `functions/_lib/llm/retry.ts` | Shared `callWithRetry`, `extractJson`, `sleep`, `DEFAULT_BACKOFF_DELAYS_MS` |
| `functions/_lib/audit/types.ts` | `AuditResult`, `AuditInput`, `AuditDeps`, sub-interfaces |
| `functions/_lib/audit/taxonomy.ts` | `FALLACY_NAMES`, `LOADED_LANGUAGE_TECHNIQUES` as const arrays + descriptions |
| `functions/_lib/audit/schemas.ts` | Zod schemas for `AuditResult` using `z.enum(FALLACY_NAMES)` |
| `functions/_lib/audit/constants.ts` | `AUDIT_MODEL`, `AUDIT_THINKING_BUDGET`, temperature, max tokens |
| `functions/_lib/audit/prompts.ts` | System prompt (with 2 worked unstated-warrant examples) + `buildAuditPrompt` |
| `functions/_lib/audit/engine.ts` | `auditText(text, deps)` + `validateQuotesInText` post-validation |
| `functions/_lib/audit/fixtures/fallacy-heavy.txt` | ~200 word op-ed with Ad Hominem, Straw Man, False Dichotomy, Slippery Slope, Appeal to Authority, Appeal to Emotion |
| `functions/_lib/audit/fixtures/clean-argument.txt` | ~200 word well-reasoned helmet-law argument |
| `scripts/run-audit.ts` | `pnpm run audit:demo` — runs both fixtures, writes `audit-output.json` |
| `tests/audit/engine.test.ts` | 11 tests: successful parse, JSON retry, two-bad-JSON throw, overload backoff, 4xx fast-fail, all-attempts-exhausted, quote validation failure, empty-findings valid; plus `validateQuotesInText` unit tests |

### Tests

11 new tests in `tests/audit/engine.test.ts`.

Full suite: **98 tests, all passing** (11 new + 87 existing).

### Build status

- `pnpm test` — 98/98 passing
- `pnpm run build` — exit 0
- `npx astro check` — 0 errors
- `pnpm run typecheck` — 0 errors

---

## Lens A, Prompt 2 — public /audit page + rate-limited endpoint

**Committed:** (this prompt)

### What was built

A public page at `/audit` with a Preact island form, and a public `POST /api/audit` endpoint with per-IP daily rate limiting. No login or secret required.

### Endpoint — `POST /api/audit`

**Request body** — exactly one of:
```json
{ "text": "string (50–10,000 chars)" }
{ "url": "https://..." }
```
Bodies with both fields, neither field, text under 50 chars, or text over 10,000 chars are rejected with 400 + `INVALID_INPUT`.

**Success response:**
```json
{ "ok": true, "audit": AuditResult, "usage": { "inputTokens": N, "outputTokens": N } }
```

**Failure response (always HTTP 200 except 400 for bad input / 503 for no API key):**
```json
{ "ok": false, "error": { "code": "RATE_LIMITED", "message": "..." } }
```

**Error codes:** `RATE_LIMITED`, `EXTRACTION_FAILED`, `TOO_SHORT`, `NOT_HTML`, `FETCH_FAILED`, `AUDIT_FAILED`, `INVALID_INPUT`

**URL path:** calls `fetchAndExtract` directly (not via the secret-gated `/api/extract-article`).

### Rate limiting

- Uses the existing `RATE_LIMIT` KV binding (same namespace as the LLM proxy).
- Key prefix: `audit:ip:<ip>` — separate bucket from the LLM `device:` / `ip:` counters.
- Cap: `AUDIT_DAILY_CAP` env var (default `10`, set in `wrangler.toml [vars]`).
- IP from `CF-Connecting-IP` header (Cloudflare injects this automatically).
- When cap is hit: `{ ok: false, error: { code: 'RATE_LIMITED', message: 'Daily audit limit reached — try again tomorrow.' } }` with HTTP 200.
- To override the cap: set `AUDIT_DAILY_CAP = "N"` in `wrangler.toml` or as an env var in the Cloudflare dashboard.

### Public page — `/audit`

Preact island (`AuditForm`) with:
- Tab switcher: **Paste text** / **Paste URL**
- Textarea (text mode): live character count, disables submit under 50 chars or over 10,000 chars
- URL input: hints about paywalled pages
- Submit button disabled until input is valid
- Loading state: "Reading and analysing — this takes 15–30 seconds."
- Error states: one friendly sentence per error code
- Results in order: Central Claim (indigo card) → Argument Structure (Toulmin, with "What is Toulmin analysis?" expander and "What's this?" on unstated warrants) → Named Fallacies (severity-coded cards) → Loaded Language (tagged list) → Notes
- Empty state: if no fallacies and no loaded language, shows a green confirmation card instead of empty sections

**Severity colours:**
- `high` → red card + red badge
- `medium` → amber card + amber badge
- `low` → grey card + grey badge

### Navigation

"Audit" added to the top nav (visible on all screen sizes — primary engagement surface) and footer nav.

### Architecture note

The endpoint logic lives in `functions/_lib/audit/handler.ts` (`handleAuditRequest(request, deps)` — pure function, no Cloudflare imports). `src/pages/api/audit.ts` is a thin Astro route that wires up the real deps. Tests import from `handler.ts` directly — no `cloudflare:workers` resolution issues.

A shared rate-limit utility was extracted to `functions/_lib/rate-limit.ts` (`RateLimitKV` interface + `checkAndIncrementQuota`). The `llm.ts` route keeps its own local copy (unchanged).

### Key files

| File | Purpose |
|---|---|
| `functions/_lib/rate-limit.ts` | Shared `RateLimitKV` interface + `checkAndIncrementQuota` utility |
| `functions/_lib/audit/handler.ts` | `handleAuditRequest(request, deps)` — all endpoint logic, injectable deps |
| `src/pages/api/audit.ts` | Thin Astro route; wires real Cloudflare deps into `handleAuditRequest` |
| `src/lib/audit.ts` | Re-exports `AuditResult` and sub-types for client-side use |
| `src/components/audit/AuditForm.tsx` | Preact island — full form + results display |
| `src/pages/audit/index.astro` | Page shell (`prerender = false`); uses `AuditForm client:load` |
| `tests/audit/endpoint.test.ts` | 15 tests: input validation (5), text path (3), URL path (3), rate limiting (3) |

### Tests

15 new tests in `tests/audit/endpoint.test.ts`.

Full suite: **113 tests, all passing** (15 new + 98 existing).

### Build status

- `pnpm test` — 113/113 passing
- `pnpm run build` — exit 0
- `npx astro check` — 0 errors
- `pnpm run typecheck` — 0 errors
