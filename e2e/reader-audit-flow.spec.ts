import { test, expect } from '@playwright/test';

// The core user action: paste text → submit → findings render. The audit and
// extraction endpoints are route-mocked so the test is deterministic and spends
// no LLM quota. The fixture is a complete, valid AuditResult.
const AUDIT_FIXTURE = {
  centralClaim: 'Raising the minimum wage always costs jobs.',
  toulmin: {
    claim: 'Raising the minimum wage costs jobs.',
    grounds: 'Higher prices reduce demand for anything, labour included.',
    statedWarrant: null,
    unstatedWarrants: [],
    weakestLink: 'Assumes the low-wage labour market clears competitively.',
  },
  namedFallacies: [
    {
      name: 'Begging the Question',
      quote: 'labour is no exception',
      explanation: 'Assumes the competitive-market premise the argument needs to prove.',
      severity: 'high',
      groundedness: { kind: 'structural' },
    },
  ],
  loadedLanguage: [],
  notes: null,
  keyTermScrutiny: [],
  referentChecks: [],
  falsifiabilityChecks: [],
  modalScopeChecks: [],
};

test('reader audits pasted text (mocked engine) and renders a finding', async ({ page }) => {
  await page.route('**/api/audit', (route) =>
    route.fulfill({ json: { ok: true, audit: AUDIT_FIXTURE, usage: { inputTokens: 100, outputTokens: 100 } } }),
  );
  // Extraction is best-effort and fired in parallel — mock it so it never hits the real endpoint.
  await page.route('**/api/extract-argument', (route) =>
    route.fulfill({ json: { ok: false, error: { code: 'MOCK', message: 'mocked in test' } } }),
  );

  // The tool lives at /audit since 2026-07-07.
  await page.goto('/audit');
  // Scoped to the READ posture: both modes are mounted since the 2026-09 merge.
  const textarea = page.locator('[data-tool-mode="read"] textarea').first();
  const submit = page.getByRole('button', { name: /Audit this argument/i });

  // The island hydrates after load; a fill before hydration is reset by the
  // controlled component. Re-fill until it sticks and enables submit.
  await expect(async () => {
    await textarea.fill(
      'Raising the minimum wage always costs jobs, because labour is no exception to the law of demand and employers will simply hire fewer workers.',
    );
    await expect(submit).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });

  await submit.click();

  // exact match — the briefings feed below also contains "begging the question".
  await expect(page.getByText('Begging the Question', { exact: true })).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// The READ/CREATE merge (2026-09)
// ---------------------------------------------------------------------------

test('the mode toggle swaps posture without clearing the other buffer', async ({ page }) => {
  await page.goto('/audit');

  const read   = page.locator('[data-tool-mode="read"]');
  const create = page.locator('[data-tool-mode="create"]');
  const toRead   = page.getByRole('tab', { name: 'READ' });
  const toCreate = page.getByRole('tab', { name: 'CREATE' });

  // READ is the default posture.
  await expect(read).toBeVisible();
  await expect(create).toBeHidden();

  // Wait for hydration before interacting. The markup is server-rendered, so
  // a click or a fill that lands first is simply lost: the click has no handler
  // attached yet, and a fill sets the DOM value without Preact ever seeing it,
  // so the first re-render resets the field to its (empty) state value. Astro
  // drops the `ssr` attribute off the island once it has hydrated.
  await expect(page.locator('astro-island[component-url*="ToolSurface"]'))
    .not.toHaveAttribute('ssr', /.*/ , { timeout: 15_000 });

  await read.locator('textarea').first().fill('a'.repeat(60));

  await toCreate.click();
  await expect(create).toBeVisible();
  await expect(read).toBeHidden();

  // The whole point of keeping both halves mounted: coming back must not have
  // wiped what was typed on the other side.
  await toRead.click();
  await expect(read).toBeVisible();
  await expect(read.locator('textarea').first()).toHaveValue('a'.repeat(60));
});

test('?mode=create opens straight into the writing posture', async ({ page }) => {
  await page.goto('/audit?mode=create');
  await expect(page.locator('[data-tool-mode="create"]')).toBeVisible();
  await expect(page.locator('[data-tool-mode="read"]')).toBeHidden();
});

test('the retired Studio URL redirects into the writing posture', async ({ page }) => {
  await page.goto('/creator/studio');
  await expect(page).toHaveURL(/\/audit\?mode=create/);
  await expect(page.locator('[data-tool-mode="create"]')).toBeVisible();
});
