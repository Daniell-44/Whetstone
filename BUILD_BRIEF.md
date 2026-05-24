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
