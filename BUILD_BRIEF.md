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

---

## Creator Studio, Prompt CS-3 — counterargument engine + Studio page

**Committed:** (this prompt)

### What was built

The analytical core of Creator Studio v1: a counterargument generation engine and the gated `/creator/studio` page that runs both the structural audit and counterargument generation in parallel on the same draft.

### Counterargument engine (`functions/_lib/counterargument/`)

| File | Purpose |
|---|---|
| `types.ts` | `Counterargument`, `CounterargumentResult`, `StrongestCase`, `CounterargDeps` interfaces |
| `schemas.ts` | Zod schemas — `counterarguments` array enforced at min 2 / max 3 |
| `constants.ts` | `COUNTERARG_MODEL = 'gemini-2.5-pro'`, `COUNTERARG_THINKING_BUDGET = 8192` |
| `prompts.ts` | System prompt (steelman instructions + 2 worked examples) + `buildCounterargPrompt` |
| `engine.ts` | `generateCounterarguments(text, deps)` — calls `callWithRetry` with the Gemini 2.5-pro model |
| `handler.ts` | `handleCounterargRequest(request, deps)` — auth gate, per-user rate limiting, body validation, calls engine |
| `fixtures/op-ed-draft.txt` | ~480-word op-ed arguing for legally mandated chronological social media feeds |

**CounterargumentResult schema:**
```typescript
interface CounterargumentResult {
  centralClaim:     string;
  counterarguments: Array<{
    position:      string;             // opposing claim, clearly stated
    strongestCase: { claim: string; grounds: string; warrant: string };
    missedByDraft: string;             // concrete: what the draft fails to engage with
    why:           string;             // why a thoughtful opponent would actually deploy this
  }>;
  notes: string | null;
}
```

**System prompt design:** Emphasises (a) steelmanning — strongest version a thoughtful opponent would actually deploy, not strawmen; (b) `missedByDraft` must reference specific passages in the draft, not generic "didn't consider the other side"; (c) `position` must have its own internal warrant, not merely negate the draft; (d) 2 worked examples anchor quality.

### POST /api/counterargument

- **Auth gate:** requires valid session — returns `401 UNAUTHORIZED` if none
- **Rate limit:** per-user KV, prefix `counterarg:user:<userId>`, cap from `COUNTERARG_DAILY_CAP` (default 20)
- **Body:** `{ text: string }` — 50–10,000 chars
- **On success:** `{ ok: true, result: CounterargumentResult, usage: { inputTokens, outputTokens } }`
- **On error:** `{ ok: false, error: { code, message } }` — codes `UNAUTHORIZED`, `RATE_LIMITED`, `INVALID_INPUT`, `AUDIT_FAILED`

### Audit endpoint — session-aware rate limiting (`functions/_lib/audit/handler.ts`)

`AuditHandlerDeps` gains two new optional fields: `getSession?` and `auditUserDailyCap?`.

Logic at the top of `handleAuditRequest`:
1. If `getSession` is provided and returns a session → skip IP limit, apply per-user limit (`audit:user:<userId>`, cap `AUDIT_USER_DAILY_CAP`, default 50)
2. If no session (or `getSession` not provided) → existing IP-based limit unchanged

Anonymous behaviour is fully backward-compatible.

### /creator/studio page

- `prerender = false`; server-side session check → redirects to `/login?returnTo=/creator/studio` if not authenticated
- Renders `<StudioEditor client:load />` Preact island

**StudioEditor.tsx** (`src/components/studio/StudioEditor.tsx`):
- Textarea (50–10,000 chars), live character count, "Analyse my draft" button (disabled while running)
- Fires `/api/audit` and `/api/counterargument` independently (not awaited together) — each section renders as its result arrives
- **Structural Audit section** — uses the extracted shared `AuditResults` component
- **Counterarguments section** — cards rendering position, Toulmin breakdown, "What your draft misses", and why
- Per-section error states including `UNAUTHORIZED` with a login link (handles session expiry mid-use)

### AuditResults extraction

`AuditResults` and its helpers (`ToulminRow`, `FallacyCard`, `LoadedLanguageRow`) extracted from `AuditForm.tsx` into `src/components/audit/AuditResults.tsx`. Both `AuditForm.tsx` (public audit page) and `StudioEditor.tsx` (Studio) import the shared component.

### New [vars] in wrangler.toml

| Variable | Default | Purpose |
|---|---|---|
| `AUDIT_USER_DAILY_CAP` | `"50"` | Per-user daily cap for authenticated audit requests |
| `COUNTERARG_DAILY_CAP` | `"20"` | Per-user daily cap for counterargument generation |

### Demo run (2026-05-27)

`npm run counterargument:demo` succeeded first attempt. Model: `gemini-2.5-pro`. Tokens: 1,930 in / 1,216 out.

Three counterarguments generated for the chronological-feeds op-ed:
1. Chronological feeds advantage high-frequency institutional publishers — swapping engagement-optimisation for frequency-optimisation
2. At scale, a chronological firehose is unusable — collapses signal-to-noise for users following hundreds of accounts
3. The root cause is the advertising business model; feed regulation is a hydraulic fix that will be routed around

See `counterargument-output.json` for the full verbatim output.

### What's still coming in CS-2

- Stripe integration + subscriptions
- Tighten the Studio gate from "any authenticated session" to "active subscriber"
- Usage tracking for billing

### Tests

22 new tests (7 engine + 11 endpoint + 4 audit session-aware).

Full suite: **152 tests, all passing** (22 new + 130 existing).

### Build status

- `npm test` — 152/152 passing
- `npm run build` — exit 0
- `npx astro check` — 0 errors, 0 warnings
- `npm run typecheck` — 0 errors

---

## Creator Studio, Prompt CS-1 — auth foundation

**Committed:** (this prompt)

### What was built

Magic-link authentication plumbing — no Studio product code. A visitor can sign up or sign in using their email. They receive a magic link, click it, and are cookie-session authenticated. They can see their account info and sign out.

### Database — D1 (SQLite)

New D1 binding `DB` added to `wrangler.toml`. **Daniel must run these commands once to provision:**

```bash
# Create production database
wrangler d1 create whetstone-users
# → paste returned database_id into wrangler.toml [[d1_databases]] database_id

# Create preview database
wrangler d1 create whetstone-users-preview
# → paste returned database_id into wrangler.toml [[d1_databases]] preview_database_id

# Apply schema to production
wrangler d1 execute whetstone-users --file=migrations/0001_init.sql

# Apply schema to preview
wrangler d1 execute whetstone-users-preview --file=migrations/0001_init.sql

# After deploying, add the DB binding in the Cloudflare Pages dashboard:
#   Settings → Functions → D1 database bindings → name: DB

# Set Resend API key as a secret after deploy
wrangler secret put RESEND_API_KEY --config dist/server/wrangler.json
```

**Resend domain:** configure `noreply@whetstone.so` as a sender in the Resend dashboard (DNS verification required). Until `whetstone.so` is active, use the Resend sandbox domain for testing.

### Schema (`migrations/0001_init.sql`)

Three tables:
- `users` — one row per email; id + email + created_at
- `sessions` — one row per active session; 30-day sliding expiry
- `magic_links` — one row per issued link; SHA-256 hash of the raw token; 15-minute expiry; consumed_at marks use

### Auth library (`functions/_lib/auth/`)

| File | Purpose |
|---|---|
| `tokens.ts` | `generateOpaqueToken()` (32-byte random hex), `hashToken()` (SHA-256 hex), `generateId()` (16-byte random hex) |
| `db.ts` | `AuthDb` interface + `makeAuthDb(D1Database)` — typed query helpers for all auth operations |
| `sessions.ts` | Cookie name/TTL constants, `sessionCookieHeader`, `clearSessionCookieHeader`, `getSessionIdFromRequest`, `getSessionFromRequest` (sliding-window extension on each read) |
| `email.ts` | `makeEmailSender(apiKey, fetch?)` — Resend REST API, sender `noreply@whetstone.so` |
| `handlers.ts` | `handleRequestLink`, `handleVerify`, `handleLogout` — all endpoint logic with injectable deps |

### Auth design

- **Token**: raw 32-byte hex, stored only in the email link. DB stores SHA-256 hash. Token is single-use (consumed_at marks use) and expires in 15 minutes.
- **Session**: 30-day sliding window — `expires_at` is extended on every authenticated page load. HttpOnly, Secure, SameSite=Lax cookie.
- **Rate limiting**: auth link requests are limited to 5/hour per IP (reuses existing `checkAndIncrementQuota` with an hourly key: `auth:rl:<ip>:<UTC-hour>`).
- **Anti-enumeration**: `handleRequestLink` always returns `{ ok: true }` regardless of whether the email is registered or the send succeeds.

### API endpoints (`src/pages/api/auth/`)

| Route | Handler |
|---|---|
| `POST /api/auth/request-link` | Validates email, rate-limits by IP, upserts user, creates magic link, sends email |
| `GET /api/auth/verify?token=` | Hashes token, validates magic link (expiry + consumed), creates session, 302 → /account |
| `GET|POST /api/auth/logout` | Deletes session, clears cookie, 302 → / |

### Pages and UI

| File | Purpose |
|---|---|
| `src/pages/login.astro` | `prerender=false`; redirects to /account if session; error banner for `?error=invalid`; Preact `LoginForm` island |
| `src/pages/account.astro` | `prerender=false`; redirects to /login if no session; shows email + session start date; sign-out form |
| `src/components/auth/LoginForm.tsx` | Preact island; POST to /api/auth/request-link; "Check your email" confirmation state |

### Nav update (`src/layouts/Base.astro`)

`isLoggedIn?: boolean` prop added. When true: "Account" link (→/account). When false (default): "Sign in" link (→/login). Dynamic auth pages pass the correct value; static pages default to Sign in.

### Type declarations (`src/env.d.ts`)

`DB: D1Database`, `RESEND_API_KEY?: string`, and `SITE_URL?: string` added to `Cloudflare.Env`.

`SITE_URL = "https://whetstone.so"` added to `[vars]` in `wrangler.toml`.

### Tests (`tests/auth/handlers.test.ts`)

17 new tests using a `FakeAuthDb` (Map-backed, implementing `AuthDb` interface) and `FakeKV`:

**handleRequestLink (8 tests):** returns 200 for new and existing users, swallows sendEmail errors (anti-enumeration), rate-limits at 5/hour, rejects invalid email with 400, rejects GET with 405, creates user + magic link records, normalises email to lowercase.

**handleVerify (5 tests):** redirects to /account + sets cookie on valid token, creates session in db, rejects missing token, rejects expired token, rejects already-consumed token, rejects unknown token.

**handleLogout (3 tests):** redirects to / + clears cookie, deletes session from db, handles missing cookie gracefully.

Full suite: **130 tests, all passing** (17 new + 113 existing).

### Build status

- `pnpm test` — 130/130 passing
- `pnpm run build` — exit 0
- `npx astro check` — 0 errors, 0 warnings (5 pre-existing hints unchanged)
- `pnpm run typecheck` — 0 errors

---

## Creator Studio, Prompt CS-2 — Stripe + subscriptions

**Committed:** (this prompt)

### What was built

The payment layer for Creator Studio v1. Users with a magic-link account can subscribe via Stripe Checkout for $15/month. After subscribing, the counterargument engine unlocks in the Studio page. Non-subscribers see an inline upsell card in the Studio and cannot reach the `/api/counterargument` endpoint. Webhooks keep subscription state in D1.

### Database — migration `0002_subscriptions.sql`

Five nullable columns added to the existing `users` table (via `ALTER TABLE`):

| Column | Type | Notes |
|---|---|---|
| `stripe_customer_id` | TEXT | Populated on first Checkout; indexed |
| `stripe_subscription_id` | TEXT | Stripe sub ID |
| `subscription_status` | TEXT | Stripe status: active, trialing, past_due, canceled, etc. |
| `subscription_current_period_end` | INTEGER | Epoch ms (Stripe gives seconds; multiplied by 1000) |
| `subscription_updated_at` | INTEGER | Epoch ms of last Stripe sync |

One subscription per user for v1; all columns null = never subscribed.

### Billing library (`functions/_lib/billing/`)

| File | Purpose |
|---|---|
| `types.ts` | `DbUserWithSubscription`, `StripeSubscription`, `BillingDb` interface |
| `stripe-client.ts` | Fetch-based Stripe REST client: `createCustomer`, `createCheckoutSession`, `createBillingPortalSession`, `retrieveSubscription`. Uses `application/x-www-form-urlencoded` with recursive bracket notation for nested objects. Accepts optional `_fetch` parameter for test injection. |
| `webhook-verify.ts` | `verifyStripeSignature(rawBody, header, secret)` — parses `Stripe-Signature` header, verifies HMAC-SHA256 via `crypto.subtle.verify` (constant-time), rejects events >5 minutes old. Returns parsed JSON on success, throws on failure. |
| `subscription.ts` | `makeBillingDb(d1)` factory + `userHasActiveSubscription`, `getUserSubscription`, `upsertSubscriptionFromStripe` helpers |
| `checkout-handler.ts` | `handleCheckoutRequest(request, deps)` — 401 if no session; creates Stripe Customer if new; creates Checkout Session; returns `{ ok: true, url }` |
| `portal-handler.ts` | `handlePortalRequest(request, deps)` — 401 if no session; 400 if no Stripe customer; creates Billing Portal session; returns `{ ok: true, url }` |
| `webhook-handler.ts` | `handleWebhookRequest(request, deps)` — verifies signature; routes `customer.subscription.*` and `invoice.payment_*` events to `upsertSubscriptionFromStripe`; always returns 200 (logs failures, no Stripe retries); injectable `verifySignature` for tests |

### Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/billing/checkout` | Session required | Create/reuse Stripe Customer → Checkout Session → return redirect URL |
| `POST /api/billing/portal` | Session required | Create Billing Portal session → return redirect URL |
| `POST /api/billing/webhook` | Signature verified | Handle Stripe events; update subscription state in D1 |

### Counterargument gate tightened

`/api/counterargument` (and its handler `handleCounterargRequest`) now has a two-step gate:
1. Session check → 401 `UNAUTHORIZED` if no session
2. Subscription check → 402 `SUBSCRIPTION_REQUIRED` if no active subscription

`checkSubscription: (userId: string) => Promise<boolean>` is now a required dep in `CounterargHandlerDeps`. The Astro route wires it to `userHasActiveSubscription(billingDb, userId)`. All existing tests updated to include `checkSubscription: async () => true`.

### Studio page — subscribe-to-unlock

`src/pages/creator/studio.astro` now computes `hasActiveSubscription` server-side (via `userHasActiveSubscription`) and passes it to the `StudioEditor` island as a prop.

`StudioEditor.tsx` behaviour by subscription state:

| State | Audit | Counterarguments section |
|---|---|---|
| `hasActiveSubscription = true` | Fires, renders results | Fires in parallel, renders results |
| `hasActiveSubscription = false` | Fires, renders results | Shows upsell card; request never fired |

The upsell card explains the feature, quotes $15/mo, and links to `/pricing`.

### Pricing page — `src/pages/pricing.astro`

SSR, public. Session-aware button CTA:

| Session state | CTA |
|---|---|
| Not logged in | "Sign in to subscribe" → `/login?returnTo=/pricing` |
| Logged in, no subscription | `CheckoutButton` Preact island → POST `/api/billing/checkout` → redirect to Stripe |
| Logged in, active subscription | "You're subscribed" + "Manage subscription →" (portal redirect via script tag) |

Hardcoded display price: **$15/mo** — see comment in the file if Daniel sets a different amount in Stripe.

### Account page additions

Subscription section below existing user info shows:
- No subscription: "No active subscription" + link to `/pricing`
- `active`/`trialing`: status badge, "Renews/Trial ends on {date}", "Manage subscription →" button
- `past_due`/`canceled`: status badge, contextual message, portal button for reactivation

Portal redirect uses a `<script>` tag (no Preact island needed — single click handler).

### New env vars

| Key | Type | Set where |
|---|---|---|
| `STRIPE_PRICE_ID` | var | `wrangler.toml [vars]` — replace placeholder after creating the Stripe product |
| `STRIPE_SECRET_KEY` | secret | `wrangler secret put` after deploy |
| `STRIPE_WEBHOOK_SECRET` | secret | `wrangler secret put` after deploy |

### Tests (35 new)

| File | Count | What is covered |
|---|---|---|
| `tests/billing/stripe-client.test.ts` | 6 | Form encoding, bracket notation, auth headers, 4xx throws |
| `tests/billing/webhook-verify.test.ts` | 7 | Valid signature, tampered body, wrong secret, stale timestamp, missing fields, boundary (300s) |
| `tests/billing/subscription.test.ts` | 9 | `userHasActiveSubscription`: active+future, trialing+future, active+expired, canceled, past_due, null status, null user; `getUserSubscription` null + present |
| `tests/billing/webhook-handler.test.ts` | 10 | Bad sig → 400, no secret → 500, subscription events (×3) upsert correctly, no user found → 200 no upsert, invoice events (×2) refresh subscription, unknown events → 200 no upsert, processing throw → 200 |
| `tests/counterargument/endpoint.test.ts` | +3 new | 402 SUBSCRIPTION_REQUIRED when no subscription, passes with subscription, auth checked before subscription |

Full suite: **187 tests, all passing** (35 new + 152 existing).

### Build status

- `npm test` — 187/187 passing
- `npm run build` — exit 0
- `npx astro check` — 0 errors
- `npm run typecheck` — 0 errors

### Stripe setup (Daniel must do before going live)

See the comment block at the top of `[vars]` in `wrangler.toml` for the ordered steps:

1. Stripe dashboard → Test Mode → Create Product "The Whetstone Creator Studio" → Add recurring monthly Price → copy `price_...` ID → paste into `wrangler.toml STRIPE_PRICE_ID`
2. Copy the Test Mode secret key (`sk_test_...`)
3. Deploy once, then add Webhook endpoint at `/api/billing/webhook` with the 5 event types listed
4. Copy webhook signing secret (`whsec_...`)
5. `npx wrangler secret put STRIPE_SECRET_KEY --config dist/server/wrangler.json`
6. `npx wrangler secret put STRIPE_WEBHOOK_SECRET --config dist/server/wrangler.json`
7. Apply migration to both databases:
   ```
   npx wrangler d1 execute whetstone-users         --file=migrations/0002_subscriptions.sql --remote
   npx wrangler d1 execute whetstone-users-preview --file=migrations/0002_subscriptions.sql --remote
   ```
8. Test end-to-end with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC

---

## Creator Studio, Prompt CS-4 — Document persistence

**Committed:** pending

A logged-in writer's Studio drafts are now saved automatically. Every audit run creates or updates a versioned snapshot; returning users see their latest work loaded on page open.

### Database schema — `migrations/0003_documents.sql`

Two new tables:

| Table | Purpose |
|---|---|
| `documents` | One row per user draft; `status IN ('active','archived')` |
| `document_versions` | Versioned content snapshots with stored results |

Key fields on `document_versions`: `content TEXT`, `audit_result TEXT` (JSON, nullable), `counterarg_result TEXT` (JSON, nullable), `version_number INTEGER`, `UNIQUE(document_id, version_number)`.

### Documents library — `functions/_lib/documents/`

| File | Exports |
|---|---|
| `types.ts` | `Document`, `DocumentVersion`, `DocumentDb` interface |
| `db.ts` | `makeDocumentDb(d1): DocumentDb` — D1-backed implementation |
| `limits.ts` | `ensureFreeUserCanCreateDocument(db, userId, hasActiveSubscription)` — auto-archives oldest document before creating a second, for free users |
| `handlers.ts` | `handleCreateDocument`, `handleCreateVersion`, `handleVersionAudit`, `handleVersionCounterarg` — each takes injectable deps for unit testing |

### REST endpoints — `src/pages/api/documents/`

| Route | Method | Description |
|---|---|---|
| `/api/documents` | GET | List active documents (auth required) |
| `/api/documents` | POST | Create document + first version; enforces free-user one-doc limit |
| `/api/documents/[id]` | GET | Get document + latest version |
| `/api/documents/[id]` | PATCH | Update title |
| `/api/documents/[id]` | DELETE | Archive document |
| `/api/documents/[id]/versions` | GET | List versions (descending) |
| `/api/documents/[id]/versions` | POST | Create new version |
| `/api/documents/[id]/versions/[versionId]` | GET | Get specific version |
| `/api/documents/[id]/versions/[versionId]/audit` | POST | Run structural audit, store result |
| `/api/documents/[id]/versions/[versionId]/counterargument` | POST | Run counterargument (subscription-gated), store result |

All routes perform ownership checks — users can only access their own documents.

### Studio editor — `src/components/studio/StudioEditor.tsx`

New props: `initialDocId`, `initialTitle`, `initialContent`, `initialVersionId`, `initialAuditResult`, `initialCounterargResult`.

New state and behaviors:
- **Title input** at the top of the editor; auto-saved (PATCH) on blur if a document exists
- **"New draft" button** shown to subscribers only; clears all state and removes `?doc=` from the URL
- **Version management** on "Analyse my draft":
  1. No docId → `POST /api/documents` → creates doc + version, updates URL to `?doc={id}`
  2. DocId + changed content → `POST /api/documents/{id}/versions` → new version
  3. DocId + same content → re-runs on existing version
- Analysis calls now go to `POST .../versions/{id}/audit` and `POST .../versions/{id}/counterargument` (storing results in DB) instead of the generic audit/counterarg endpoints
- On load with `?doc=`: stored audit and counterarg results are shown immediately from server-side props (no loading flash)

### Studio page — `src/pages/creator/studio.astro`

- Reads `?doc=` query param; loads document + latest version from D1 if found and owned by session user
- Parses and passes stored `audit_result` and `counterarg_result` JSON to the StudioEditor island
- Nav now includes "My documents →" link

### Documents list page — `src/pages/creator/documents.astro`

- Auth-gated; lists all active documents for the session user, sorted by `updated_at DESC`
- Each row links to `/creator/studio?doc={id}`
- "New draft" button links to `/creator/studio` (no `?doc=` → creates fresh document on first run)

### Free vs. paid behaviour

| Tier | Active documents | Revision history |
|---|---|---|
| Free (no subscription) | 1 (oldest auto-archived on new create) | Last run only |
| Subscribed | Unlimited | Full history accessible via API |

### Tests (28 new)

| File | Count | What is covered |
|---|---|---|
| `tests/documents/db.test.ts` | 9 | Map-backed fake DocumentDb: create, list, count, update title, create versions, latest version, stored results, list order |
| `tests/documents/handlers.test.ts` | 19 | `handleCreateDocument` (auth, input validation, free limit, paid), `handleCreateVersion` (auth, ownership), `handleVersionAudit` (auth, ownership, version check, 503 on no key), `handleVersionCounterarg` (auth, 402 on no subscription, ownership, result storage), limits integration |

Full suite: **215 tests, all passing** (28 new + 187 existing).

### Build status

- `npm test` — 215/215 passing
- `npx astro check` — 0 errors

### Migration command (Daniel must run before going live)

```
npx wrangler d1 execute whetstone-users         --file=migrations/0003_documents.sql --remote
npx wrangler d1 execute whetstone-users-preview --file=migrations/0003_documents.sql --remote
```

---

## Creator Studio, Prompt CS-5 — Revision history + comparison view

**Committed:** (this prompt)

Writers can now browse every saved version of a draft, read a past version in full, restore it as the current version, and compare two versions side by side to see exactly what changed in their argument's structure.

### Diff library — `functions/_lib/documents/diff.ts`

Pure, side-effect-free module. Two public functions:

| Function | Returns |
|---|---|
| `diffAuditResults(fromJson, toJson)` | `AuditDiff` — matching by `name::normalised-quote-head` for fallacies, `normalised-phrase::technique` for loaded language |
| `diffCounterargResults(fromJson, toJson)` | `CounterargumentDiff` — side-by-side counterargument arrays |

`AuditDiff` carries: `fromAudited`, `toAudited`, `fallacies: { removed, added, persisted }`, `loadedLanguage: { removed, added, persisted }`, `unstatedWarrants`, `toulmin`, `centralClaim: { from, to, changed }`, and a `summary` object with pre-computed counts. Null-safe throughout — both inputs can be null (neither version audited).

### New endpoint — `POST /api/documents/[id]/versions/[versionId]/restore`

Creates a new version whose content is copied from the specified version. Ownership and version-document binding are both checked. Returns `{ ok: true, versionId, versionNumber }`.

Handler: `handleRestoreVersion` in `functions/_lib/documents/handlers.ts`. Route at `src/pages/api/documents/[id]/versions/[versionId]/restore.ts` (7 `../` import depth).

### New Preact islands

| Component | Purpose |
|---|---|
| `src/components/studio/VersionsList.tsx` | Checkbox list with sticky "Compare selected versions" footer; navigates to `/compare?from=&to=` |
| `src/components/studio/ComparisonView.tsx` | Full diff display: summary card (stat pills), collapsible content side-by-side, Toulmin comparison, fallacy diff (removed/added/persisted), loaded-language diff, counterarg side-by-side |
| `src/components/studio/RestoreButton.tsx` | Single-action island; calls restore endpoint, redirects to Studio on success |
| `src/components/studio/CounterargumentResultDisplay.tsx` | Extracted from StudioEditor; shared by single-version view and comparison view |

### New pages

| Page | Route | What it shows |
|---|---|---|
| `src/pages/creator/documents/[id]/versions.astro` | `/creator/documents/{id}/versions` | All versions for a document; VersionsList island; checkbox+compare |
| `src/pages/creator/documents/[id]/versions/[versionId].astro` | `.../versions/{versionId}` | Read-only: draft content, stored audit + counterarg results, Restore button |
| `src/pages/creator/documents/[id]/compare.astro` | `.../compare?from={id}&to={id}` | Server-computes diff; renders ComparisonView island |

Import-depth note: `[id]/versions.astro` and `compare.astro` use 5 `../` to reach project root; `[id]/versions/[versionId].astro` uses 6 `../`.

### StudioEditor.tsx updates

- Removed inline `CounterargResults` function; replaced with `CounterargumentResultDisplay` import
- Added "History" link (visible when `docId` is non-null, hidden when draft is unsaved)

### documents.astro update

Each document row now shows a "{n} versions" link to `/creator/documents/{id}/versions`. Version counts loaded with `Promise.all` over `countVersionsForDocument` calls.

### Tests (15 new)

| File | Count | What is covered |
|---|---|---|
| `tests/documents/diff.test.ts` | 10 | Both null, from-null+to-audited, same fallacy persists, same name+diff quote = removed+added, fallacy removed, loaded-language match, central claim changed, counterarg both-null, from-generated, both-generated |
| `tests/documents/db.test.ts` | +1 | `countVersionsForDocument` — count, zero for missing doc |
| `tests/documents/handlers.test.ts` | +4 | `handleRestoreVersion`: happy path (content copied, versionNumber incremented), 401 unauthenticated, 404 wrong user, 404 version on wrong doc |

Full suite: **230 tests, all passing** (15 new + 215 existing).

### Build status

- `npm test` — 230/230 passing
- `npx astro check` — 0 errors
- `npm run build` — exit 0

---

## Creator Studio, Prompt CS-6 — Language and pricing

**Committed:** (this prompt)

Two small but user-facing changes: friendlier display labels on all analytical output surfaces, and a price bump from $15 to $22/mo.

### Label system — `src/lib/labels.ts`

New `LABELS` and `TOOLTIPS` constants centralise every user-visible string for the analytical vocabulary. Internal TypeScript types, Zod schemas, prompt templates, DB columns, and function names are **unchanged** — only the strings humans read on screen changed.

17 label keys:

| Key | Display string |
|---|---|
| `toulmin` | Argument Structure |
| `namedFallacies` | Reasoning Patterns |
| `loadedLanguage` | Word Choice |
| `unstatedWarrants` | Hidden Assumptions |
| `centralClaim` | Main Claim |
| `weakestLink` | Weakest Point |
| `counterarguments` | Strongest Opposing Cases |
| `counterargPosition` | Position |
| `counterargCase` | Their Strongest Case |
| `missedByDraft` | What your draft doesn't engage with |
| `counterargWhy` | Why this opposition is hard to dismiss |
| `toulminClaim` | The claim |
| `toulminGrounds` | The evidence |
| `toulminWarrant` | The connecting assumption |
| `diffRemoved` | Fixed in the revision |
| `diffAdded` | Newly appeared |
| `diffPersisted` | Still present |

Each key also has a `TOOLTIPS` entry with two sentences (`plain` and `pedigree`, each under 25 words) shown via a native `<details>` disclosure element.

### LabelWithTooltip component — `src/components/ui/LabelWithTooltip.tsx`

Preact component. Props: `{ label: keyof typeof LABELS }`. Renders the friendly label text followed by a `(?)` summary that expands an inline `<details>` tooltip with the plain + pedigree text. No JavaScript state — pure HTML. Reset styles (`font-normal normal-case tracking-normal`) prevent heading styles bleeding into the tooltip.

Works in both Preact islands (client-side) and Astro server-side rendering (no `client:` directive needed).

### Surfaces updated

| File | What changed |
|---|---|
| `src/components/audit/AuditResults.tsx` | All section headings use LabelWithTooltip; `ToulminRow` label type widened to `ComponentChildren`; "No named fallacies or loaded language" → "No reasoning patterns or loaded language" |
| `src/components/studio/CounterargumentResultDisplay.tsx` | All labels use LabelWithTooltip |
| `src/components/studio/StudioEditor.tsx` | Both "Counterarguments" h2 headings use LabelWithTooltip; loading hint copy de-jargonised |
| `src/components/studio/ComparisonView.tsx` | All diff category labels and section headings use LabelWithTooltip and LABELS constants |
| `src/components/scorecard/PositionCard.astro` | "Claim", "Grounds", "Warrant — the load-bearing assumption" replaced with LabelWithTooltip |
| `src/pages/creator.astro` | Meta description and hero paragraph: "Toulmin breakdown, reasoning-pattern flags" → "argument structure, reasoning patterns"; feature list: "Toulmin decomposition" → "Argument Structure", "Reasoning-pattern flags" → "Reasoning Patterns" |
| `src/pages/pricing.astro` | $15 → $22 in display price, meta description, and inline comment; feature list: "Toulmin analysis, named fallacies, loaded language" → "Argument Structure, Reasoning Patterns, Word Choice" |
| `src/pages/account.astro` | "Subscribe to Studio — $15/mo" → "$22/mo" |
| `wrangler.toml` | Stripe checklist comment: "$15/mo" → "$22/mo (bumped from $15 in CS-6)"; `STRIPE_PRICE_ID` comment updated. **Daniel must create a new Stripe Price at $22 and update `STRIPE_PRICE_ID`.** |

### Tests, check, build

- `npm test` — 230/230 passing (no engine changes; no new tests needed)
- `npx astro check` — 0 errors
- `npm run build` — exit 0
- `npm run typecheck` — 0 errors

---

## Creator Studio, Prompt CS-7 — Audit engine refinement: expanded taxonomy + conviction meter

**Committed:** (this prompt)

Two coordinated improvements to the audit engine: a wider fallacy vocabulary (12 → 23 patterns) and a uniform confidence + severity signal on every finding type.

### Expanded fallacy taxonomy — `functions/_lib/audit/taxonomy.ts`

| # | Name | Category |
|---|---|---|
| 1 | Ad Hominem | Original |
| 2 | Straw Man | Original |
| 3 | False Dichotomy | Original |
| 4 | Slippery Slope | Original |
| 5 | Appeal to Authority | Original |
| 6 | Appeal to Emotion | Original |
| 7 | Circular Reasoning | Original |
| 8 | Hasty Generalisation | Original |
| 9 | Red Herring | Original |
| 10 | Tu Quoque | Original |
| 11 | Post Hoc | Original |
| 12 | Equivocation | Original |
| 13 | Abductive Closure | Peirce inferential |
| 14 | Selection Bias | Peirce inferential |
| 15 | Base-Rate Neglect | Peirce inferential |
| 16 | No True Scotsman | Classical/modern |
| 17 | Cherry-Picking | Classical/modern |
| 18 | Texas Sharpshooter | Classical/modern |
| 19 | Composition | Classical/modern |
| 20 | Division | Classical/modern |
| 21 | Argument from Ignorance | Classical/modern |
| 22 | Gish Gallop | Classical/modern |
| 23 | Moving the Goalposts | Classical/modern |

**⚠ Daniel must confirm this list before deploy.** The commit contains the full taxonomy; confirmation is the gate for going live.

`FALLACY_DESCRIPTIONS` updated with a one-line description for each new entry. `FALLACY_NAMES` is the source of truth for the Zod enum in `schemas.ts` and the list in the system prompt — both update automatically.

### Confidence + uniform severity — `functions/_lib/audit/types.ts`, `schemas.ts`

All three finding types (`NamedFallacy`, `LoadedLanguage`, `UnstatedWarrant`) now carry:

| Field | Type | Notes |
|---|---|---|
| `severity` | `'high' \| 'medium' \| 'low'` | How serious the finding would be if real |
| `confidence` | `number` (integer 0–100) | How certain the engine is the finding is accurate |

`NamedFallacy` already had `severity`; it gains `confidence`. `LoadedLanguage` and `UnstatedWarrant` gain both. Zod validators: `z.number().int().min(0).max(100)` for confidence, `z.enum(['high', 'medium', 'low'])` for severity.

### System prompt — `functions/_lib/audit/prompts.ts`

Three additions:

1. **Output format** — JSON schema updated; all three finding types now include `"severity"` and `"confidence"` fields.
2. **"Assigning confidence and severity" section** — Calibration guidance:
   - 90–100: clear-cut; a careful reader would agree immediately
   - 70–89: strong reading; charitable reader could disagree
   - 50–69: defensible but uncertain
   - Below 50: do not include the finding
   - Severity: high = argument fails if finding holds; medium = weakens but survives; low = rhetorical noise, not load-bearing
3. **Confusable pattern guidance** — Selection Bias vs Cherry-Picking (sample population vs citation selection); Texas Sharpshooter vs Hasty Generalisation (post-hoc pattern vs small sample).

### Priority-score utility — `functions/_lib/audit/priority.ts`

```typescript
priorityScore(finding): number   // severityWeight × (confidence / 100)
sortByPriority(findings): T[]    // immutable sort, descending priority
```

Weights: high = 3, medium = 2, low = 1.

Re-exported from `src/lib/audit.ts` for use in display components.

### Display — `src/components/audit/AuditResults.tsx`

All three finding sections now:
- Sort by `priorityScore` descending before rendering
- Show a **severity badge** (red / amber / grey, already existing on fallacies; extended to loaded language and unstated warrants)
- Show a **confidence indicator** as a numeric percentage (`{confidence}%` in muted gray text) — chose numeric over four-dot visual because all real-world scores fall in the 50–100 range, making dots resolve to 3–4 filled dots with poor discrimination; a number is unambiguous

### Tests (38 new; 268 total)

| File | Count | What is covered |
|---|---|---|
| `tests/audit/priority.test.ts` | 12 | `priorityScore` (6 cases incl. edge values), `sortByPriority` (4 cases incl. immutability + empty) |
| `tests/audit/schemas.test.ts` | 26 | Confidence range/type enforcement (reject <0, >100, non-integer, missing); severity enum enforcement (reject unknown string, missing); new taxonomy names accepted; valid findings pass |

Existing test fixtures updated: `engine.test.ts` (added `confidence` + `severity` to warrant and fallacy fixtures), `diff.test.ts` (added `confidence` + `severity` to typed `NamedFallacy`/`LoadedLanguage` fixtures).

### Demo run (2026-05-31)

`npm run audit:demo` — both fixtures pass with the new schema.

**Fallacy-heavy fixture:** 7 fallacies (same patterns as before; no false positives from new taxonomy), 11 loaded-language findings. Confidence range: 88–98 on fallacies (well-calibrated — clear-cut cases score high, ambiguous Post Hoc scores 90). Severity spread: high (False Dichotomy ×2, Ad Hominem, Straw Man), medium (Appeal to Authority, Post Hoc, Slippery Slope), low (loaded-language items that are rhetorical noise).

**Clean-argument fixture:** 0 fallacies, 1 loaded-language finding ("straightforward" at confidence 75, severity low — a genuinely borderline call the model correctly scores with reduced confidence). Engine correctly holds the higher confidence bar.

None of the 11 new patterns surfaced on the fallacy-heavy fixture — this is correct because the fixture does not exhibit Cherry-Picking, Texas Sharpshooter, etc. No false positives.

### Build status

- `npm test` — 268/268 passing (38 new + 230 existing)
- `npx astro check` — 0 errors
- `npm run build` — exit 0
- `npm run typecheck` — 0 errors

---

## CS-9: Feedback mechanism (2026-06-01)

Per-finding thumbs-up / thumbs-down with optional qualitative reason, persisted to D1. An admin endpoint lets Daniel pull aggregated feedback monthly and feed the patterns back into prompt tuning manually (Pathway A from research v3 — no fine-tuning, no few-shot injection, just human review and iteration).

### Schema — `migrations/0006_feedback.sql`

```sql
CREATE TABLE feedback (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  document_id      TEXT,
  version_id       TEXT,
  feedback_type    TEXT NOT NULL,   -- 'finding_thumbs_up' | 'finding_thumbs_down' | 'audit_rating' | 'bug_report'
  target_lens      TEXT,            -- 'namedFallacies' | 'loadedLanguage' | 'unstatedWarrants' | 'counterarguments'
  match_key        TEXT,            -- stable finding identifier (reuses match-keys library)
  finding_snapshot TEXT,            -- JSON of the full finding at feedback time
  rating           INTEGER,
  qualitative      TEXT,            -- optional user text, max 500 chars
  created_at       INTEGER NOT NULL
);
```

Apply to both databases:
```bash
npx wrangler d1 execute whetstone-users         --file=migrations/0006_feedback.sql --remote
npx wrangler d1 execute whetstone-users-preview --file=migrations/0006_feedback.sql --remote
```

### Backend library — `functions/_lib/feedback/`

| File | Contents |
|---|---|
| `types.ts` | `FeedbackType`, `TargetLens`, `FeedbackRow`, `FeedbackSubmission`, `FeedbackSummary` |
| `db.ts` | `makeFeedbackDb(d1)` → `recordFeedback`, `listFeedbackSince`, `summariseFeedback` |
| `handler.ts` | `handleSubmitFeedback` (POST, session-gated, rate-limited 60/day), `handleAdminFeedback` (GET, secret-gated) |

`summariseFeedback` runs two SQL queries (count-grouped and qualitative list) — no application-layer aggregation against full row scans.

### Submit endpoint — `POST /api/feedback`

Session-gated. Validates that finding-level types include `targetLens`, `matchKey`, and `findingSnapshot`. Ownership-checks document when `documentId` is provided. Rate limit: 60 per user per day using the existing `RATE_LIMIT` KV, prefix `feedback:user:`.

### Admin review endpoint — `GET /api/admin/feedback`

Gated by `X-Analyser-Secret` header (existing `ANALYSER_SECRET` env var).

**Query parameters:**

| Param | Values | Notes |
|---|---|---|
| `since` | ISO date or `"7d"` / `"30d"` | Required |
| `lens` | `namedFallacies` \| `loadedLanguage` \| ... | Optional filter |
| `type` | `finding_thumbs_down` \| ... | Optional filter |
| `format` | `summary` (default) \| `json` | `json` returns raw rows |

**Monthly review workflow:**
```bash
# Full summary — last 30 days
curl -H "X-Analyser-Secret: $ANALYSER_SECRET" \
  "https://<worker>.workers.dev/api/admin/feedback?since=30d"

# Downvotes only, namedFallacies lens — show what users disagreed with
curl -H "X-Analyser-Secret: $ANALYSER_SECRET" \
  "https://<worker>.workers.dev/api/admin/feedback?since=30d&type=finding_thumbs_down&lens=namedFallacies"

# Raw rows for deeper inspection
curl -H "X-Analyser-Secret: $ANALYSER_SECRET" \
  "https://<worker>.workers.dev/api/admin/feedback?since=30d&format=json"
```

**Example summary response** (with 3 hypothetical feedback entries — 2 thumbs-down, 1 thumbs-up on namedFallacies):

```json
{
  "ok": true,
  "period": { "since": "2026-05-01T00:00:00.000Z", "until": "2026-06-01T12:00:00.000Z" },
  "totals": { "thumbsUp": 1, "thumbsDown": 2, "auditRatings": 0, "bugReports": 0 },
  "byLens": {
    "namedFallacies":   { "up": 1, "down": 2, "downRate": 0.67 },
    "loadedLanguage":   { "up": 0, "down": 0, "downRate": 0 },
    "unstatedWarrants": { "up": 0, "down": 0, "downRate": 0 },
    "counterarguments": { "up": 0, "down": 0, "downRate": 0 }
  },
  "qualitativeReasons": [
    {
      "lens": "namedFallacies",
      "type": "finding_thumbs_down",
      "text": "The quote is taken out of context — the author immediately acknowledged this point.",
      "createdAt": "2026-05-28T14:23:11.000Z",
      "findingSnapshot": {
        "name": "Appeal to Authority",
        "quote": "Professor Hartley, a leading criminologist, has repeatedly stated that gun-free zones reduce violence — and if an expert says it, that settles the debate.",
        "severity": "medium",
        "confidence": 98
      }
    },
    {
      "lens": "namedFallacies",
      "type": "finding_thumbs_down",
      "text": "This is stylistic emphasis, not a straw man — they're summarising for speed.",
      "createdAt": "2026-05-15T09:41:03.000Z",
      "findingSnapshot": { "name": "Straw Man", "severity": "high", "confidence": 95, "quote": "..." }
    }
  ]
}
```

A `downRate` above 0.3 on any lens is a signal worth investigating. Use `findingSnapshot` to reconstruct what the user saw at feedback time — the engine's prompts may have changed since.

### UI — `src/components/audit/AuditResults.tsx`

Each finding card now includes a small thumbs-up / thumbs-down icon pair, rendered only when `documentId` is provided (anonymous public `/audit` and `/reader` users do not see the affordance — the simpler hidden-not-disabled approach was chosen; no tooltip needed since the rest of the card is also not interactive for anonymous users).

**Interaction flow:**
- **Thumbs-up**: immediate POST to `/api/feedback`, icon fills green. Clicking again toggles off (client-side only — no DELETE; neutral state is not persisted to the server. A fresh page load shows no votes. This is acceptable because feedback is append-only signal, not a two-way editable record.)
- **Thumbs-down**: opens an inline expander with a textarea (500-char max, optional). Two buttons: "Submit feedback" (with qualitative) and "Just downvote" (empty qualitative). Either path closes the expander and fires a POST. Clicking the active thumbs-down again toggles off client-side.

`FeedbackBtns` is a self-contained Preact component with local state — no shared hook needed since votes are independent per finding.

**Surfaces covered:** Studio editor (with `documentId` + `versionId` from state), version history read-only page (`client:load` added, `docId` + `versionId` threaded from URL params). Public `/audit` (no `documentId` → hidden). `/reader` (no `documentId` → hidden).

### Account page

Small acknowledgement note added below the subscription section: "Your feedback shapes The Whetstone — thumbs-up and thumbs-down on findings help tune the engine over time. Thank you."

### Tests (32 new; 320 total)

| File | Count | What is covered |
|---|---|---|
| `tests/feedback/submit.test.ts` | 18 | Auth (401, 405), validation (all required fields for finding types, 500-char limit, ownership check), success (records correctly, stores snapshot as JSON, all four lenses), rate limiting (cap enforced, kv optional) |
| `tests/feedback/admin.test.ts` | 14 | Auth (no header, wrong secret, unconfigured secret), `since` parsing (missing, invalid, ISO, 7d/30d relative, date filter), summary format, json format, lens/type filters |

### Build status

- `npx vitest run` — 320/320 passing (32 new + 288 existing)
- `npx astro check` — 0 errors
- `npm run build` — exit 0

---

## CS-10: Phase-2 lenses — Wittgensteinian key-term scrutiny, Russellian referent checks, Davidsonian falsifiability (2026-06-01)

Three new analytical lenses grounded in philosophy of language, gated by `includePhase2: boolean` — logged-in users get all seven lenses; anonymous users get the base four (cheaper and faster).

### New types — `functions/_lib/audit/types.ts`

Three new issue-type unions and three new finding interfaces:

| Interface | Fields |
|---|---|
| `KeyTermScrutinyFinding` | `term`, `usage_a` (verbatim), `usage_b` (verbatim), `issue: KeyTermIssue`, `explanation`, `severity`, `confidence` |
| `ReferentCheckFinding` | `phrase` (verbatim), `issue: ReferentIssue`, `explanation`, `evidence` (verbatim), `severity`, `confidence` |
| `FalsifiabilityFinding` | `claim`, `issue: FalsifiabilityIssue`, `explanation`, `evidence` (verbatim), `severity`, `confidence` |

`KeyTermIssue`: `stipulative-smuggling | cross-language-game-equivocation | family-resemblance-overreach`
`ReferentIssue`: `empty-referent | vague-proper-name | failed-presupposition`
`FalsifiabilityIssue`: `no-truth-conditions | circular-truth-conditions | unfalsifiable-dressed-as-substantive`

`AuditResult` gains three new array fields: `keyTermScrutiny`, `referentChecks`, `falsifiabilityChecks`.
`AuditDeps` gains `includePhase2?: boolean`.

### Schemas — `functions/_lib/audit/schemas.ts`

Three new Zod schemas (`KeyTermScrutinyFindingSchema`, `ReferentCheckFindingSchema`, `FalsifiabilityFindingSchema`). All three new arrays in `AuditResultSchema` use `.default([])` so anonymous audits (which return no Phase-2 output) pass validation without a separate schema variant.

### Prompts — `functions/_lib/audit/prompts.ts`

`AUDIT_SYSTEM_PROMPT` (constant string) replaced by `buildSystemPrompt(includePhase2: boolean)` function. When `includePhase2: true`, three new instruction sections are appended:

- **Key-Term Scrutiny (Wittgenstein):** meaning-as-use; flag terms that silently shift language-game between uses. Three sub-types: stipulative smuggling, cross-language-game equivocation, family-resemblance overreach. Includes two worked examples each. What NOT to do: don't flag ordinary polysemy, don't confuse with loaded language.
- **Referent Check (Russell):** empty, vague, or presupposition-failing referents. Three sub-types: empty referent (e.g., "real Americans"), vague proper name (e.g., "the establishment"), failed presupposition (e.g., "the proven link between X and Y"). What NOT to do: don't flag collective nouns where the referent is clear enough.
- **Falsifiability Check (Davidson):** claims with no truth conditions, circular truth conditions, or structured immunity to falsification. Three sub-types with worked examples each. What NOT to do: don't flag normative claims merely because they're not empirically testable.

The Phase-2 output format (JSON schema in the prompt) is also conditionally injected — only logged-in users see the three new output fields in the schema instructions.

### Engine — `functions/_lib/audit/engine.ts` + `constants.ts`

- `auditText` now calls `buildSystemPrompt(deps.includePhase2 ?? false)` instead of the former constant.
- `validateQuotesInText` extended to check `usage_a` and `usage_b` on `keyTermScrutiny` findings, and `evidence` on `referentChecks` and `falsifiabilityChecks` findings.
- Thinking budget bumped from **4096 → 6144** in `constants.ts` to give the model headroom for the expanded instruction set.

### Handler — `functions/_lib/audit/handler.ts`

`auditText` call gains `includePhase2: session !== null` — logged-in users automatically get Phase-2 depth; anonymous requests use the base four-lens prompt.

### Match-keys — `functions/_lib/audit/match-keys.ts`

Three new functions:

| Function | Key format |
|---|---|
| `keyTermMatchKey({ term, issue })` | `keyterm:<normalised-term>:<issue>` |
| `referentMatchKey({ phrase, issue })` | `referent:<normalised-phrase-30>:<issue>` |
| `falsifiabilityMatchKey({ claim, issue })` | `falsifiability:<normalised-claim-40>:<issue>` |

### Labels — `src/lib/labels.ts`

Three new LABELS + TOOLTIPS entries:

| Key | Display | Pedigree |
|---|---|---|
| `keyTermScrutiny` | Word Use | Wittgenstein's meaning-as-use |
| `referentChecks` | Vague References | Russell's theory of descriptions |
| `falsifiabilityChecks` | Testability | Davidson's truth-conditional semantics |

### Feedback — `functions/_lib/feedback/types.ts` + `handler.ts` + `db.ts`

`TargetLens` extended with three new values: `keyTermScrutiny`, `referentChecks`, `falsifiabilityChecks`. The `byLens` summary object in `db.ts` extended with the new keys.

### Display — `src/components/audit/AuditResults.tsx`

Three new card sub-components (`KeyTermCard`, `ReferentCard`, `FalsifiabilityCard`) with severity badge, confidence indicator, verbatim evidence quote, explanation, `FindingActionBtns`, and `FeedbackBtns`. Each section only renders when findings are present. Dismissed-toggle pattern applied to all three. Three new dismiss-state variables added.

### Demo run (2026-06-01)

`npm run audit:demo` with `includePhase2: true`:

**Fallacy-heavy fixture:** 8 fallacies, 11–15 loaded-language, **2 referent checks** (vague referents in the gun-control text — e.g., contested group labels), 0 key-term issues, 0 falsifiability issues. Tokens: ~4559 in / ~2800 out.

**Clean-argument fixture:** 0 fallacies, 1 loaded-language, **0 Phase-2 findings** (clean-argument correctly generates no Phase-2 findings). Tokens: ~4593 in / ~750 out.

The referent findings on the fallacy-heavy text are plausible — group labels in political argument texts are a natural target for the empty-referent pattern.

### Tests (41 new; 361 total)

| File | Count | What is covered |
|---|---|---|
| `tests/audit/schemas.test.ts` | +28 | `KeyTermScrutinyFindingSchema` (valid, all 3 issues, bad issue, missing fields, confidence/severity), `ReferentCheckFindingSchema` (valid, all 3 issues, bad issue, missing evidence, empty evidence), `FalsifiabilityFindingSchema` (valid, all 3 issues, bad issue, missing fields); `AuditResultSchema` Phase-2 defaults to `[]`, accepts valid findings, rejects invalid |
| `tests/audit/phase2.test.ts` | 20 | `keyTermMatchKey` (stable key, normalises case+punctuation, differs on issue/term, prefix); `referentMatchKey` (stable key, normalises whitespace, differs on issue, prefix); `falsifiabilityMatchKey` (stable key, normalises case+punctuation, differs on issue, prefix); `buildSystemPrompt(false)` — omits Phase-2 sections; `buildSystemPrompt(true)` — includes all 3 sections + all 9 issue-type strings; base content always present; handler gating: session → Phase-2 prompt, anonymous → base prompt, no getSession → base prompt |

### Build status

- `npx vitest run` — 361/361 passing (41 new + 320 existing)
- `npx astro check` — 0 errors
- `npm run build` — exit 0


---

## CS-11: Argument extraction — The Whetstone (2026-06-01)

A new analytical lens that renders a writer's argument in formal logical terms: numbered premises (P1, P2…) and conclusions (C1, C2…) with annotated inference rules. This is **clarification**, not critique — the extraction shows the argument's skeleton before the audit shows its flaws.

### New module — `functions/_lib/argument-extraction/`

| File | Contents |
|---|---|
| `types.ts` | `InferenceRule` union (9 values), `ExtractionStatement`, `ArgumentExtractionResult`, `ExtractionDeps` |
| `schemas.ts` | `INFERENCE_RULES` const, `ExtractionStatementSchema`, `ArgumentExtractionResultSchema`; `derivedFrom`/`inferenceRule`/`inferenceRuleExplanation` are `.nullish()` |
| `constants.ts` | `EXTRACTION_MODEL = 'gemini-2.5-flash'`, `EXTRACTION_THINKING_BUDGET = 3072` |
| `prompts.ts` | `EXTRACTION_SYSTEM_PROMPT` — 6 normalisation rules, What NOT to do, empty-case JSON, output format, 3 worked examples |
| `engine.ts` | `extractArgument(text, deps)` — calls `callWithRetry` with `responseFormat: 'json'`, `thinkingBudget: 3072` |
| `handler.ts` | `handleExtractionRequest(request, deps)` — same auth/rate-limit pattern as audit handler; key prefix `extract:ip:` / `extract:user:` |
| `fixtures/social-media-draft.txt` | ~280-word op-ed arguing for social media regulation |

**`InferenceRule` values:** `modus_ponens`, `modus_tollens`, `hypothetical_syllogism`, `disjunctive_syllogism`, `categorical_syllogism`, `inductive_generalisation`, `abduction`, `analogy`, `other`

### Public endpoint — `POST /api/extract-argument`

Text-only (no URL), 50–20,000 chars. Rate limiting reuses `AUDIT_DAILY_CAP` / `AUDIT_USER_DAILY_CAP` env vars with `extract:` prefix.

### Per-version endpoint — `POST /api/documents/[id]/versions/[versionId]/extraction`

Auth-gated, stores result in D1 via `storeExtractionOnVersion`. `handleVersionExtraction` added to `functions/_lib/documents/handlers.ts`.

### Database — `migrations/0007_extraction_storage.sql`

```sql
ALTER TABLE document_versions ADD COLUMN extraction_json TEXT;
```

Apply:
```bash
npx wrangler d1 execute whetstone-users         --file=migrations/0007_extraction_storage.sql --remote
npx wrangler d1 execute whetstone-users-preview --file=migrations/0007_extraction_storage.sql --remote
```

### Display component — `src/components/extraction/ArgumentExtraction.tsx`

Preact component. Gray cards for premises, blue cards for conclusions. `∴ from P1, P2…` derivation line. Inference rule badge + explanation per conclusion. `★` in id or text triggers italic-gray implicit-premise styling.

### Studio — `src/components/studio/StudioEditor.tsx`

`extraction` fires in parallel with `audit` and `counterargument`. **Argument Skeleton** card (emerald border) placed **above** the Structural Audit card — skeleton before critique.

### Public /audit form — `src/components/audit/AuditForm.tsx`

Text-tab submissions run `/api/extract-argument` in parallel via `Promise.allSettled`. Extraction failure is best-effort. Extraction result displayed above audit in an emerald card.

### Labels — `src/lib/labels.ts`

Four new entries: `extraction` (Argument Structure), `extractionPremise` (Premise), `extractionConclusion` (Conclusion), `extractionInferenceRule` (Inference).

### Demo run (2026-06-01)

`npm run extraction:demo` — `social-media-draft.txt`:
- `centralClaim`: "Some form of regulatory intervention for social media platforms is justified to address the degradation of public discourse."
- 12 statements (8 premises, 4 conclusions) including ★P5, ★P7, ★P8 (implicit bridging premises correctly identified)
- `confidence`: 95%, tokens: 2,107 in / 1,169 out
- Inference chain: `other` (C1) → `categorical_syllogism` (C2) → `modus_ponens` (C3, C4)

**Quality:** High — model correctly identified implicit premises, used ★ marker in ids, and traced a clean 4-step argument chain from empirical observation to policy conclusion.

See `extraction-output.json` for verbatim output.

### Tests (26 new; 387 total)

| File | Count | What is covered |
|---|---|---|
| `tests/extraction/schemas.test.ts` | 15 | Statement and result schemas; all 9 inference rules accepted; confidence range/type; null notes |
| `tests/extraction/engine.test.ts` | 6 | Successful parse, empty case, JSON retry, two-bad-JSON throw, retryable backoff, non-retryable fast-fail |
| `tests/extraction/handler.test.ts` | 5 | 400 bad JSON, 400 short text, 503 no key, 200 valid, per-user rate limit |

### Build status

- `npm test` — 387/387 passing (26 new + 361 existing)
- `npx astro check` — 0 errors
- `npm run build` — exit 0

---

## CS-12: Philosophical commitments detection — The Whetstone (2026-06-02)

A new Solo-tier lens that identifies the implicit philosophical frameworks embedded in a writer's argument — ethical, epistemic, political, and methodological — plus 1–3 alternative perspectives showing how readers from different frameworks would object. This is **framework awareness**, not advocacy: the goal is to help writers see the invisible assumptions their argument depends on.

### New module — `functions/_lib/philosophical-commitments/`

| File | Contents |
|---|---|
| `types.ts` | `EthicalFramework`, `EpistemicCommitment`, `PoliticalFramework`, `MethodologicalCommitment` union types; `FrameworkDetection<T>`, `AlternativePerspective`, `PhilosophicalCommitmentsResult`, `CommitmentsDeps` |
| `schemas.ts` | `ETHICAL_FRAMEWORKS`, `EPISTEMIC_COMMITMENTS`, `POLITICAL_FRAMEWORKS`, `METHODOLOGICAL_COMMITMENTS`, `FRAMEWORK_TYPES` const arrays; `FrameworkDetectionSchema` (generic helper, `ZodTypeAny`); `AlternativePerspectiveSchema`; `PhilosophicalCommitmentsResultSchema` — all 4 dimensions nullable, `alternativePerspectives: min(1).max(3)` |
| `constants.ts` | `COMMITMENTS_MODEL = 'gemini-2.5-pro'`, `COMMITMENTS_THINKING_BUDGET = 8192` |
| `prompts.ts` | `COMMITMENTS_SYSTEM_PROMPT` — purpose, 4 dimensions with enums, evidence requirements, null-if-<60-confidence calibration, alternative perspectives guidance (draft-specific, 1–3), What NOT to do, 2 worked examples |
| `engine.ts` | `detectCommitments(text, deps)` — calls `callWithRetry<PhilosophicalCommitmentsResult>` with explicit type assertion to bridge the `ZodTypeAny` generic |
| `handler.ts` | `handleCommitmentsRequest(request, deps)` — session 401, subscription 402, per-user rate limit `commitments:user:`, `COMMITMENTS_DAILY_CAP` env var (default 15) |
| `fixtures/helmet-law-argument.txt` | ~280-word helmet law policy argument (same clean-argument fixture as CS-11) |

**Ethical frameworks:** `consequentialist`, `deontological`, `virtue_ethics`, `contractualist`, `utilitarian`, `pluralist`, `unclear`
**Epistemic commitments:** `empiricist`, `rationalist`, `experiential`, `authoritative`, `mixed`, `unclear`
**Political frameworks:** `liberal`, `libertarian`, `communitarian`, `conservative`, `progressive`, `socialist`, `pluralist`, `unclear`
**Methodological commitments:** `reductionist`, `holist`, `individualist`, `structuralist`, `universalist`, `contextualist`, `mixed`, `unclear`

### Public endpoint — `POST /api/philosophical-commitments`

Session + active subscription required (401/402 gates). Rate limit `commitments:user:`, cap from `COMMITMENTS_DAILY_CAP` (default 15/day). Body: `{ text: string }`, 50–10,000 chars.

### Per-version endpoint — `POST /api/documents/[id]/versions/[versionId]/commitments`

Auth + subscription gated. Stores result via `storeCommitmentsOnVersion`. `handleVersionCommitments` + `VersionCommitmentsDeps` added to `functions/_lib/documents/handlers.ts`.

### Database — `migrations/0008_commitments_storage.sql`

```sql
ALTER TABLE document_versions ADD COLUMN commitments_json TEXT;
```

Apply:
```bash
npx wrangler d1 execute whetstone-users         --file=migrations/0008_commitments_storage.sql --remote
npx wrangler d1 execute whetstone-users-preview --file=migrations/0008_commitments_storage.sql --remote
```

### Display component — `src/components/commitments/PhilosophicalCommitmentsDisplay.tsx`

Preact component. 2×2 grid of dimension cards (purple, `bg-purple-50 border-purple-100`). Null dimension → "No clear framework signal" in muted gray. Framework name badge + confidence percentage + explanation + italicised evidence quote. Alternative perspectives in amber cards (`bg-amber-50 border-amber-100`) with framework type badge, objection, and specificity. Notes footer. No accept/dismiss/thumbs on individual detections.

### Studio — `src/components/studio/StudioEditor.tsx`

`commitmentsState` fires in parallel with `counterargument` for subscribed users. **Framework Check** card (purple border) placed **below** the counterargument section. Non-subscribed users do not see the section at all.

### Labels — `src/lib/labels.ts`

Six new LABELS + TOOLTIPS entries:

| Key | Display | Pedigree anchor |
|---|---|---|
| `commitments` | Framework Check | Every argument embeds framework-level assumptions |
| `commitmentsEthical` | Ethical Framework | Consequentialism, deontology, virtue ethics, contractualism |
| `commitmentsEpistemic` | Epistemic Stance | Empiricism, rationalism, appeal to authority |
| `commitmentsPolitical` | Political Framework | Liberal, communitarian, libertarian, progressive |
| `commitmentsMethodological` | Methodological Approach | Reductionism vs holism, individualism vs structuralism |
| `commitmentsAlternatives` | Alternative Perspectives | Framework-level objections reveal blind spots |

### Env var — `wrangler.toml [vars]`

```toml
COMMITMENTS_DAILY_CAP = "15"
```

### Demo run (2026-06-02)

`npm run commitments:demo` — `helmet-law-argument.txt`:
- `ethical`: consequentialist 95% — *"built on weighing outcomes: injury reduction and taxpayer cost"*
- `epistemic`: empiricist 98% — *"relies exclusively on empirical data: 2019 BMJ meta-analysis, Australian/NZ studies"*
- `political`: communitarian 88% — *"individual actions have consequences for the community (taxpayers) that can legitimately be regulated"*
- `methodological`: universalist 80% — *"findings presented as generally applicable across age groups and cycling conditions"*
- 1 alternative perspective: deontological, targets the economic-argument premise specifically — *"making a fundamental right contingent on its financial convenience to the collective"*
- tokens: 2,639 in / 782 out

**Quality:** High. All four frameworks are grounded in specific draft sentences, not generic descriptions. Confidence scores are well-calibrated (98% empiricist is clear-cut; 80% universalist is genuinely debatable). The single deontological alternative is draft-specific and not a generic "autonomy matters" complaint.

See `commitments-output.json` for verbatim output.

### Tests (35 new; 422 total)

| File | Count | What is covered |
|---|---|---|
| `tests/commitments/schemas.test.ts` | 18 | `AlternativePerspectiveSchema`: valid, invalid frameworkType, all frameworkTypes, empty strings; `PhilosophicalCommitmentsResultSchema`: valid, all-null dimensions, all 4 enum sets (all values), unknown framework rejected, 0 alternatives rejected, >3 alternatives rejected, null/string notes, confidence out-of-range |
| `tests/commitments/engine.test.ts` | 5 | Successful parse, JSON retry, two-bad-JSON throw, retryable backoff, non-retryable fast-fail |
| `tests/commitments/endpoint.test.ts` | 7 | 401 no session, 402 no subscription, 400 bad JSON, 400 short text, 503 no key, 200 valid subscribed, per-user rate limit |
| `tests/documents/handlers.test.ts` | +5 | `handleVersionCommitments`: happy path, 401, 402 no subscription, 503 no key, 404 version on wrong doc |
| `tests/documents/db.test.ts` | +1 | `storeCommitmentsOnVersion` |

### Build status

- `npm test` — 422/422 passing (35 new + 387 existing)
- `npx astro check` — 0 errors (0 warnings)

---

## CS-13 — Formal-language toggle

**Goal**: Logged-in users can switch labels site-wide between accessible plain English ("Hidden Assumptions") and precise philosophical terminology ("Unstated Warrants") via a preference saved to their account.

### What was built

**Label system (`src/lib/labels.ts`)**
- Restructured into `LABELS_PLAIN` and `LABELS_FORMAL` (30 keys each, all audit lenses, extraction fields, counterarg sections, diff dimensions, commitments)
- `LABELS_FORMAL` uses `as const satisfies { [K in keyof typeof LABELS_PLAIN]: string }` — validates key parity without constraining values to the same string literals
- `TOOLTIPS_PLAIN` and `TOOLTIPS_FORMAL` — each entry has `{ plain, pedigree }` strings; formal pedigrees are denser (reference Wittgenstein, Russell, Toulmin, Popper, Davidson)
- `TerminologyPreference = 'plain' | 'formal'` type exported
- `getLabels(preference?)` and `getTooltips(preference?)` helpers returning the correct dictionary
- Backward-compat `LABELS = LABELS_PLAIN` and `TOOLTIPS = TOOLTIPS_PLAIN` re-exports — zero changes needed in files that don't use the formal variant

**DB layer**
- `migrations/0009_terminology_preference.sql` — `ALTER TABLE users ADD COLUMN terminology_preference TEXT NOT NULL DEFAULT 'plain'`
- `functions/_lib/auth/db.ts`: `TerminologyPreference` type, `terminology_preference: string` on `DbUser`, `getTerminologyPreference`/`setTerminologyPreference` on `AuthDb` interface, D1 implementation in `makeAuthDb`

**API endpoint (`src/pages/api/account/terminology.ts`)**
- `PATCH /api/account/terminology` — auth-gated, Zod-validated `{ preference: 'plain' | 'formal' }` body, saves to D1, returns `{ ok: true, preference }`

**UI (`src/components/account/TerminologyPicker.tsx`)**
- Preact island: radio group (Accessible / Formal), auto-saves on change via `PATCH /api/account/terminology`, inline Saving/Saved/Error status

**Account page (`src/pages/account.astro`)**
- Reads `terminology_preference` from D1 per request, renders `<TerminologyPicker initialPreference={terminology} client:load />`

**Label threading**
- `src/components/ui/LabelWithTooltip.tsx` — added `preference?: TerminologyPreference` prop
- `src/components/audit/AuditResults.tsx` — 12 `<LabelWithTooltip>` calls updated
- `src/components/studio/CounterargumentResultDisplay.tsx` — 6 calls updated
- `src/components/studio/ComparisonView.tsx` — converted `LABELS` import to `getLabels(terminologyPreference)`
- `src/components/commitments/PhilosophicalCommitmentsDisplay.tsx` — 2 calls updated
- `src/components/extraction/ArgumentExtraction.tsx` — 3 calls updated
- `src/components/studio/StudioEditor.tsx` — passes `terminologyPreference` to all child islands
- `src/pages/creator/studio.astro` — reads preference from D1, passes to `<StudioEditor>`
- `src/pages/creator/documents/[id]/versions/[versionId].astro` — reads and passes to `<AuditResults>` and `<CounterargumentResultDisplay>`
- `src/pages/creator/documents/[id]/compare.astro` — reads and passes to `<ComparisonView>`

### Migration commands

```bash
npx wrangler d1 execute whetstone-users         --file=migrations/0009_terminology_preference.sql --remote
npx wrangler d1 execute whetstone-users-preview --file=migrations/0009_terminology_preference.sql --remote
```

### Tests (29 new; 451 total)

| File | Count | What is covered |
|---|---|---|
| `tests/terminology/labels.test.ts` | 16 | `LABELS_PLAIN` 30 keys, non-empty values; `LABELS_FORMAL` same 30 keys, technical term spot-checks, differs from plain on >15 keys; `TOOLTIPS_PLAIN`/`TOOLTIPS_FORMAL` completeness, non-empty strings, formal pedigrees longer; backward-compat `LABELS`/`TOOLTIPS` same references; `getLabels()`/`getTooltips()` return correct variant |
| `tests/terminology/endpoint.test.ts` | 8 | 401 unauthenticated, 400 invalid JSON, 400 invalid preference value, 200 plain saved, 200 formal saved, override existing; `FakeAuthDb` defaults to plain, persists value |
| `tests/auth/handlers.test.ts` | +5 | `FakeAuthDb` extended with `getTerminologyPreference`/`setTerminologyPreference`; `DbUser` literals updated with `terminology_preference: 'plain'` |

### Build status

- `npm test` — 451/451 passing (29 new + 422 existing)
- `npx astro check` — 0 errors (0 warnings, 10 hints pre-existing)

---

## CS-14 — Citation Audit

**Goal**: For each factual claim in a Studio draft that's backed by a cited source, fetch the source and check whether it actually supports the claim. Produces per-claim verdicts (well_cited / weakly_cited / mismatched / uncited / unfetchable) with source excerpts — the most differentiated Studio feature for journalists and researchers.

### What was built

**Module: `functions/_lib/citation-audit/`**
- `types.ts` — `CitationVerdict` union, `CitedClaim`, `CitationAuditResult` interfaces
- `schemas.ts` — Zod schemas for Stage 1 (extraction), Stage 2 (verdict), and full result with cross-field consistency refinements
- `constants.ts` — `CITATION_CLAIM_EXTRACTION_MODEL`, `CITATION_VERDICT_MODEL` (both `gemini-2.5-flash`), `MAX_CITED_CLAIMS_PER_AUDIT = 15`, `CITATION_FETCH_TIMEOUT_MS = 10000`, `CITATION_FETCH_PARALLELISM = 4`
- `prompts.ts` — Stage 1 system prompt (factual claim extraction with worked example covering inline, footnote, and uncited cases) + Stage 2 system prompt (verdict with confidence calibration guidance)
- `engine.ts` — `auditCitations()` two-stage pipeline: Stage 1 extracts claims → fetch URLs in batches of 4 → Stage 2 verdict per claim (skipped for uncited/unfetchable) → sort by severity → compute summary. Returns `{ result, inputTokens, outputTokens, citationsFetched, citationsFailed }`
- `handler.ts` — Auth gate → subscription gate → per-user rate limit (`citation:user:${userId}`) → Zod body validation → engine call → usage response
- `fixtures/sample-draft.ts` — 400-word op-ed with 6 factual claims: 4 with example.org URLs (unfetchable in demo), 2 uncited

**Endpoint: `src/pages/api/citation-audit.ts`**
- POST `/api/citation-audit`, body `{ text: string }` 50–10,000 chars
- Auth + subscription gated; rate limit from `CITATION_DAILY_CAP` env var (default 10/day)
- Returns `{ ok, result, usage: { inputTokens, outputTokens, citationsFetched, citationsFailed } }`

**Storage: `migrations/0010_citation_audit_storage.sql`**
- `ALTER TABLE document_versions ADD COLUMN citation_audit_json TEXT`
- `DocumentVersion` interface and `DocumentDb` extended with `storeCitationAuditOnVersion`

**Labels (`src/lib/labels.ts`)** — 6 new keys in both LABELS_PLAIN and LABELS_FORMAL:
- `citationAudit`, `citationVerdictWell`, `citationVerdictWeak`, `citationVerdictMismatch`, `citationVerdictUncited`, `citationVerdictUnfetchable`
- Full tooltips in both TOOLTIPS_PLAIN and TOOLTIPS_FORMAL
- Total key count: 30 → 36

**Match key (`functions/_lib/audit/match-keys.ts`)**
- `citationMatchKey(c)` → `citation:${verdict}:${normalise(claim, 50)}`

**Display component (`src/components/citation-audit/CitationAuditDisplay.tsx`)**
- Summary card: pill counts for mismatched/uncited/unfetchable/weak/well
- Per-claim cards sorted by verdict severity (mismatched → uncited → unfetchable → weakly_cited → well_cited), confidence descending within group
- Verdict badges with severity colours, collapsible source excerpt, citation URL link
- Per-finding actions (addressed/dismiss + thumbs) wired to finding-actions API

**Studio integration (`src/components/studio/StudioEditor.tsx`)**
- New `citationAuditState` + `CitationAuditApiResponse` type
- `citationDone` completion flag added to `checkDone()`
- Citation audit fires in parallel with other engines (subscribed users only): `POST /api/citation-audit` with `{ text: draft }`
- Loading copy updated to "60–90 seconds" to reflect URL fetching
- `CitationUpsell` component for non-subscribed users
- `CitationAuditDisplay` rendered in results panel below philosophical commitments
- `initialCitationAuditResult` prop for hydrating from stored data

**wrangler.toml** — `CITATION_DAILY_CAP = "10"` added to `[vars]`

**`src/env.d.ts`** — `CITATION_DAILY_CAP?: string` added to Cloudflare Env interface

**`scripts/run-citation-audit.ts`** — Demo script (`npm run citation:demo`), writes `citation-audit-output.json`

### Two-stage pipeline

**Stage 1 — Claim extraction** (`triage` operation, gemini-2.5-flash)
- Identifies factual claims only (not normative claims, not author's arguments)
- For each: normalised claim text, verbatim evidence quote, citation URL (inline/footnote/parenthetical or null), footnote context
- One LLM call per audit

**Stage 2 — Per-claim verdict** (`analyze` operation, gemini-2.5-flash)
- Called only for claims with a successfully fetched source
- Produces: verdict, explanation grounded in source content, source excerpt (≤200 chars), confidence (90–100 clear-cut; 60–89 defensible)
- Uncited claims: marked directly without LLM call
- Unfetchable claims: marked directly without LLM call

**Concurrency**: URL fetches are batched by `CITATION_FETCH_PARALLELISM = 4`; URLs are deduplicated before fetching (one fetch per unique URL even if cited by multiple claims); Stage 2 calls run in parallel via `Promise.allSettled`

### Migration command

```bash
npx wrangler d1 execute whetstone-users         --file=migrations/0010_citation_audit_storage.sql --remote
npx wrangler d1 execute whetstone-users-preview --file=migrations/0010_citation_audit_storage.sql --remote
```

### Tests (33 new; 484 total)

| File | Count | What is covered |
|---|---|---|
| `tests/citation-audit/schemas.test.ts` | 16 | `ExtractedClaimsSchema`: valid mixed URLs, invalid URL, empty claim, empty array; `VerdictResultSchema`: all verdicts, null excerpt, bad verdict, confidence out-of-range, excerpt over 250 chars; `CitationAuditResultSchema`: valid, total mismatch, count mismatch, notes, zero claims, non_factual excluded from counts |
| `tests/citation-audit/engine.test.ts` | 7 | End-to-end mixed cited+uncited, unfetchable path (no Stage 2 call), uncited path (no fetch, no Stage 2), URL deduplication, CITATION_FETCH_PARALLELISM limit, sort order, token accumulation |
| `tests/citation-audit/endpoint.test.ts` | 10 | 401 no session, 402 no subscription, 429 rate limit, 400 short text, 400 long text, 400 invalid JSON, 503 no API key, 200 valid + usage fields, 405 GET, per-user rate limit isolation |

### Build status

- `npm test` — 484/484 passing (33 new + 451 existing)
- `npx astro check` — 0 errors (0 warnings, 13 hints pre-existing)
- `npm run build` — clean

---

## CS-15 — Multi-seat Workspaces

**Goal**: A workspace abstraction that owns documents and has members with roles. One active subscription on any member entitles the entire workspace. Members are invited by email using a magic-link-style token flow.

### Schema — `migrations/0011_workspaces.sql`

Three new tables + one new column on `documents`:

| Table / Change | Purpose |
|---|---|
| `workspaces` | One row per workspace; `owner_id` references `users.id` |
| `workspace_members` | Many-to-many join between users and workspaces; `role IN ('owner','admin','member')` |
| `workspace_invitations` | Pending invitations; token stored as SHA-256 hash; 7-day expiry; `accepted_at NULL` = still pending |
| `documents.workspace_id` | Nullable FK to `workspaces.id`; null = pre-backfill personal document |

Indexes on workspace owner, member user/workspace, invitation token hash, and document workspace.

### Backfill strategy — `migrations/0012_workspaces_backfill.sql`

Documentation-only — explains the backfill. Actual backfill runs via `POST /api/admin/backfill-workspaces`:
- For each user with no workspace membership: creates a personal workspace, adds user as owner, sets `workspace_id` on all their existing documents.
- Idempotent — skip users who already have a membership.

### Workspace library — `functions/_lib/workspaces/`

| File | Contents |
|---|---|
| `types.ts` | `WorkspaceRole`, `Workspace`, `WorkspaceMember`, `WorkspaceInvitation`, `WorkspaceWithRole`, `WorkspaceDb` interface |
| `db.ts` | `makeWorkspaceDb(d1): WorkspaceDb` — D1-backed implementation |
| `permissions.ts` | `userHasActiveSubscriptionViaWorkspace(billingDb, workspaceDb, userId)`, `canManageWorkspace(role)`, `isOwner(role)` |
| `handlers.ts` | All workspace endpoint logic: list/create/get/update/delete workspace; list/update/remove members; list/create/revoke invitations; accept invitation; backfill |

### Subscription gate refactor

`userHasActiveSubscriptionViaWorkspace` replaces `userHasActiveSubscription` at all subscription-check call sites:
1. First checks the user directly.
2. If not subscribed, iterates their workspaces and checks each co-member — returns `true` on the first subscribed co-member.

Updated call sites:
- `src/pages/api/citation-audit.ts`
- `src/pages/api/counterargument.ts`
- `src/pages/api/documents/index.ts`
- `src/pages/api/documents/[id]/versions/[versionId]/counterargument.ts`
- `src/pages/api/documents/[id]/versions/[versionId]/commitments.ts`
- `src/pages/api/philosophical-commitments.ts`
- `src/pages/creator/studio.astro`
- `src/pages/pricing.astro`

### Document scoping

- `Document` interface gains `workspace_id: string | null`.
- `DocumentDb` gains `listActiveDocumentsForWorkspace(workspaceId)` and optional 4th arg `workspaceId?` on `createDocument`.
- `D1` implementation updated accordingly.

### API endpoints

| Route | Method | Handler |
|---|---|---|
| `/api/workspaces` | GET | List user's workspaces |
| `/api/workspaces` | POST | Create workspace (caller becomes owner) |
| `/api/workspaces/[id]` | GET | Get workspace + members + caller role |
| `/api/workspaces/[id]` | PATCH | Rename (owner/admin only) |
| `/api/workspaces/[id]` | DELETE | Delete (owner only; blocked if other members exist) |
| `/api/workspaces/[id]/members` | GET | List members (any member) |
| `/api/workspaces/[id]/members/[memberUserId]` | PATCH | Update role (owner only; cannot change own role) |
| `/api/workspaces/[id]/members/[memberUserId]` | DELETE | Remove member (owner/admin; or self-remove; cannot remove owner) |
| `/api/workspaces/[id]/invitations` | GET | List pending invitations (owner/admin only) |
| `/api/workspaces/[id]/invitations` | POST | Create invitation + send email (owner/admin only) |
| `/api/workspaces/[id]/invitations/[invId]` | DELETE | Revoke invitation (owner/admin only) |
| `/api/workspaces/invitations/accept?token=` | GET | Accept invitation; redirects unauthenticated users to login with returnTo |
| `/api/admin/backfill-workspaces` | POST | Secret-gated backfill; returns `{ workspacesCreated: N }` |

### Invitation flow

Same pattern as magic links: `generateOpaqueToken()` raw token sent in email URL; DB stores `hashToken(token)`; accept endpoint hashes the incoming token and looks it up.

- Unauthenticated visitor → redirect to `/login?returnTo=/api/workspaces/invitations/accept?token=<t>`
- Authenticated user, valid token → add as member, mark accepted, redirect to `/workspaces/<id>/settings?joined=1`
- Expired / already-accepted → redirect to `/login?error=invalid_invitation`

Email sent via `makeWorkspaceInvitationSender` (new function in `functions/_lib/auth/email.ts`). Best-effort — invitation is created even if email fails.

### UI

**`src/components/layout/WorkspaceSwitcher.tsx`** — Preact island. Fetches workspaces from `GET /api/workspaces` on mount. Renders a dropdown showing current workspace name + role. Clicking a workspace navigates to `/creator/documents?workspace=<id>`. "New workspace" option POSTs to create one and redirects to its settings page.

**`src/pages/workspaces/[id]/settings.astro`** — SSR. Shows: workspace name (rename form for owner/admin); member list with role + joined date (owner can remove non-owners); invite-by-email form (owner/admin only); pending invitations list with revoke buttons; leave/delete workspace at the bottom. All mutations are client-side JS calls to the API routes. Shows "joined" banner on `?joined=1`.

**`src/pages/creator/documents.astro`** — Updated: reads `?workspace=<id>` query param; if provided and user is a member, shows workspace documents via `listActiveDocumentsForWorkspace`; renders `WorkspaceSwitcher` in the header.

### Email — `functions/_lib/auth/email.ts`

`makeWorkspaceInvitationSender(resendApiKey)` added: sends "You've been invited to join <workspace>" email with a 7-day accept link.

### Migration command

```bash
wrangler d1 execute whetstone-users         --file=migrations/0011_workspaces.sql --remote
wrangler d1 execute whetstone-users-preview --file=migrations/0011_workspaces.sql --remote
```

Then run the backfill:
```bash
curl -X POST \
  -H "X-Analyser-Secret: $ANALYSER_SECRET" \
  https://devils-advocate-site.daniellivingstone2005.workers.dev/api/admin/backfill-workspaces
```

### Tests (64 new; 548 total)

| File | Count | What is covered |
|---|---|---|
| `tests/workspaces/db.test.ts` | 13 | create/retrieve workspace, missing workspace returns null, add/retrieve/count members, list workspaces for user, rename, delete, remove member, update role, create/find/list/accept/delete invitations, find pending by email |
| `tests/workspaces/permissions.test.ts` | 9 | `userHasActiveSubscriptionViaWorkspace`: user has direct sub, no sub anywhere, co-member has sub, expired co-member sub, no workspaces+no sub, multi-workspace short-circuits; `canManageWorkspace`/`isOwner` edge cases |
| `tests/workspaces/endpoints.test.ts` | 31 | `handleListWorkspaces` (401, empty, returns list), `handleCreateWorkspace` (401, 400, creates + owner), `handleGetWorkspace` (401, 404, returns workspace+members+role), `handleUpdateWorkspace` (401, 403, renames), `handleDeleteWorkspace` (403, 409 when members exist, deletes), `handleListMembers` (404, returns list), `handleUpdateMember` (promote, 409 self-change, 403 non-owner), `handleRemoveMember` (removes, 409 owner, self-remove), `handleListInvitations` (403, returns list), `handleRevokeInvitation`, `handleBackfillWorkspaces` (401 no secret, 401 wrong, 405 GET, zero created) |
| `tests/workspaces/invitations.test.ts` | 11 | `handleCreateInvitation`: 401, 403, 400 bad email, creates + normalises to lowercase, 409 duplicate pending, sendInvitation called with correct accept URL; `handleAcceptInvitation`: redirect to login unauthenticated, invalid token, no token, accepts + adds member + marks accepted, expired, idempotent (second call rejected) |

### Build status

- `npx vitest run` — 548/548 passing (64 new + 484 existing)
- `npx astro check` — 0 errors
- `npm run build` — clean
