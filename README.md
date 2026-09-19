# The Whetstone

A structural audit engine for arguments, and the publication built around it.
Paste an argument — or a link to one — and it returns the reasoning underneath:
the claim, the warrants holding it up, and the named patterns where the logic
gives way. It does not tell you who is right.

Live at **https://thewhetstone.review**.

Three surfaces over one engine:

| Surface | What it is |
|---|---|
| **Briefings** (`/`) | Edited pieces on contested questions — each position stated at its strongest, then audited |
| **The Audit** (`/audit`) | Paste text or a URL, get the full lens suite back |
| **Studio** (`/creator/studio`) | The same engine against your own draft, with revision history |

**No account is required for any of it**, and nothing is paid. Everyone gets
three audits per rolling 24 hours. An account exists only to keep your drafts
and version history between visits.

---

## Running locally

Requires **Node ≥ 22.12** and **pnpm 10**.

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then fill in GEMINI_API_KEY
pnpm dev                         # http://localhost:4321
```

Without `GEMINI_API_KEY` the site renders and navigates, but every engine call
returns 503. Everything else in `.dev.vars.example` is optional and degrades
gracefully — see that file for what each one turns on.

### Verifying

```bash
pnpm run typecheck   # tsc over functions/**
pnpm run check       # astro check over src/** — pages, components, API routes
pnpm test            # vitest, 684 tests, no secrets needed
pnpm run test:e2e    # playwright; needs .dev.vars because it boots astro dev
                     #   first run: npx playwright install chromium
pnpm run verify      # all four
```

CI runs everything except e2e, which needs the Cloudflare bindings.

---

## Architecture

**Astro 6** (SSR) + **Preact** islands + **Tailwind v4**, deployed as a single
**Cloudflare Worker** via `@astrojs/cloudflare`.

```
src/
  pages/            39 routes + 61 API endpoints
  components/       Preact islands and Astro partials
  content/          briefings as markdown with a custom block syntax
  layouts/          Base.astro — shell, nav, OG tags, PWA wiring
functions/_lib/     the engines; framework-free and unit-tested
  audit/            the core lens suite
  <lens>/           presupposition, rhetorical-mode, humility, …
  auth/ billing/    sessions, magic links, dormant subscription code
  documents/        drafts and version history
  rate-limit.ts     KV-backed quotas
migrations/         D1 schema, applied in filename order
eval/ evals/        engine quality harness and corpus
tests/              52 vitest files
```

Each engine follows the same shape: a framework-free `handler.ts` taking an
injectable deps object, wrapped by a thin route under `src/pages/api/`. Tests
target the handler, so nothing needs a running Worker.

### Bindings

Configured in `wrangler.toml`; must also exist in the Cloudflare dashboard.

| Binding | Kind | Holds |
|---|---|---|
| `DB` | D1 | users, sessions, documents, workspaces, feedback |
| `RATE_LIMIT` | KV | usage quotas |
| `SESSION` | KV | session storage |
| `SCORECARDS` | KV | published scorecard JSON |
| `AUDIT_LINKS` | KV | shareable audit permalinks (30-day TTL) |

---

## Deploying

Pushing to `master` builds, verifies and deploys via
`.github/workflows/deploy.yml`. It needs `CLOUDFLARE_API_TOKEN` in repository
secrets.

By hand:

```bash
pnpm run build
npx wrangler deploy --config dist/server/wrangler.json
```

The Cloudflare adapter emits the Worker config during the build, so deploy
reads `dist/server/wrangler.json` rather than the repo-root `wrangler.toml`.

### Migrations

Not automatic — apply before deploying a schema change:

```bash
npx wrangler d1 execute whetstone-users --file=migrations/00NN_name.sql --remote
```

---

## Engine quality

`eval/SCORECARD.md` tracks each engine version against a planted-defect corpus:
false positives on clean controls, defect location recall, quote-verbatim
integrity, and run-to-run consistency. `eval/FRONTIER_DIFFS.md` compares the
production engine against a frontier model on real published op-eds.

```bash
pnpm eval:score   # recompute the deterministic metrics
```

Both files are worth reading before changing a prompt — they record which
weaknesses are known and measured, and which claims about the engine survive a
skeptic reading the raw output.

---

## Licence

MIT — see [LICENSE](./LICENSE).
