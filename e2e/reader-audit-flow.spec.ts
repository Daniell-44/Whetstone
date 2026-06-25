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

  await page.goto('/');
  const textarea = page.locator('textarea').first();
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
